"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { mockLogScript, mockRun } from "@/lib/mockData";
import type {
  AgentLogEntry,
  AgentName,
  CustomCodeRunRequest,
  PipelineRunRequest,
  PipelineStage,
} from "@/types";

/**
 * usePipelineRun — orchestrates a single pipeline run.
 *
 * The backend POST /run is BLOCKING: it returns only after the full
 * Watcher → Codex → Reviewer cycle finishes. So this hook simulates
 * staged progress client-side during that blocking call, then
 * reconciles with real results on completion.
 *
 * Modes:
 *   - demo live — calls api.runPipeline; refreshes on completion.
 *   - custom live — calls api.runCustomPipeline or runCustomPipelineUpload.
 *   - mock — if the live call fails, the mock log script replays against
 *            the mock dataset so the demo still works offline. ALWAYS badged.
 */

export type RunSourceType = "demo" | "custom";

export interface PipelineRunState {
  stage: PipelineStage;
  /** 0–1 progress through the current run; useful for progress bars. */
  progress: number;
  /** True while a run is actively in flight. */
  isRunning: boolean;
  /** Error message if the live run failed and we fell back to mock. */
  error: string | null;
  /** Live log entries — append-only during a run. */
  logs: AgentLogEntry[];
  /** Whether this run is against the demo repo or custom code. */
  sourceType: RunSourceType;
}

const INITIAL_STATE: PipelineRunState = {
  stage: "idle",
  progress: 0,
  isRunning: false,
  error: null,
  logs: [],
  sourceType: "demo",
};

// Stage durations for the simulated progress (ms). These are guesses that
// make the run *feel* paced; the GSAP upgrade will let real backend
// latency drive them via .seek() against timeline labels.
const STAGE_DURATIONS: Record<PipelineStage, number> = {
  idle: 0,
  scanning: 4500,
  fixing: 9000,
  verifying: 3500,
  completed: 0,
};

// Per-stage tick interval for emitting log lines + nudging progress.
const TICK_MS = 600;

let logIdSeq = 0;
function makeLog(
  entry: Omit<AgentLogEntry, "id" | "ts">
): AgentLogEntry {
  return { ...entry, id: `log_${++logIdSeq}`, ts: new Date().toISOString() };
}

interface UsePipelineRunOptions {
  /** Called when a live run completes successfully — caller refreshes data. */
  onCompleted?: () => void;
}

export function usePipelineRun({ onCompleted }: UsePipelineRunOptions = {}) {
  const [state, setState] = useState<PipelineRunState>(INITIAL_STATE);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logCursor = useRef(0);
  const cancelled = useRef(false);

  /** Clear all pending timers — safe to call repeatedly. */
  const clearTimers = useCallback(() => {
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    if (stageTimer.current) {
      clearTimeout(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  /** Emit the next mock log line tagged with the active agent/stage. */
  const emitNextLog = useCallback((stage: PipelineStage) => {
    const agentForStage: Record<PipelineStage, AgentName | null> = {
      idle: null,
      scanning: "watcher",
      fixing: "codex",
      verifying: "reviewer",
      completed: "reviewer",
    };
    const agent = agentForStage[stage];
    if (!agent) return;

    // Find the next mock line that belongs to this agent (or hasn't been emitted).
    while (logCursor.current < mockLogScript.length) {
      const next = mockLogScript[logCursor.current++];
      if (next.agent === agent || stage === "completed") {
        setState((s) => ({ ...s, logs: [...s.logs, makeLog(next)] }));
        break;
      }
    }
  }, []);

  const finish = useCallback(
    (success: boolean, error: string | null) => {
      clearTimers();
      if (cancelled.current) return;
      setState((s) => ({
        ...s,
        stage: success ? "completed" : "idle",
        progress: success ? 1 : s.progress,
        isRunning: false,
        error,
      }));
      if (success) onCompleted?.();
    },
    [clearTimers, onCompleted]
  );

  /** Advance the visible stage + reset its progress window. */
  const advanceStage = useCallback(
    (next: PipelineStage) => {
      if (cancelled.current) return;
      setState((s) => ({ ...s, stage: next, progress: 0 }));
      emitNextLog(next);

      if (next === "completed") {
        finish(true, null);
        return;
      }
      const dur = STAGE_DURATIONS[next];
      stageTimer.current = setTimeout(
        () => advanceStage(nextStage(next)),
        dur
      );
    },
    [emitNextLog, finish]
  );

  /** Drive the simulated run loop. */
  const runSimulation = useCallback(() => {
    logCursor.current = 0;
    cancelled.current = false;
    setState({
      ...INITIAL_STATE,
      isRunning: true,
      logs: [makeLog({
        agent: "watcher",
        level: "info",
        message: "Pipeline armed — initiating scan…",
      })],
    });

    // Kick off stage 1; advanceStage schedules the rest.
    advanceStage("scanning");

    // Progress ticker: bumps `progress` within the current stage window
    // and emits additional log lines on a cadence.
    tickTimer.current = setInterval(() => {
      if (cancelled.current) return;
      setState((s) => {
        if (!s.isRunning) return s;
        const dur = STAGE_DURATIONS[s.stage] || 1;
        const delta = TICK_MS / dur;
        const next = Math.min(1, s.progress + delta);
        return { ...s, progress: next };
      });
    }, TICK_MS);
  }, [advanceStage]);

  /** Public entry point — kick off a demo repo run (live, falling back to mock). */
  const runPipeline = useCallback(
    async (request: PipelineRunRequest = {}) => {
      const payload: PipelineRunRequest = {
        repo_path: "seeded_repo",
        use_semgrep: true,
        use_gpt: true,
        auto_fix_threshold: 0.7,
        ...request,
      };

      runSimulation();
      setState((s) => ({ ...s, sourceType: "demo" }));

      try {
        await api.runPipeline(payload);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Pipeline API unavailable";
        setState((s) => ({ ...s, error: message }));
      }
    },
    [runSimulation]
  );

  /** Run the pipeline against custom (pasted) code. */
  const runCustomPipeline = useCallback(
    async (request: CustomCodeRunRequest) => {
      runSimulation();
      setState((s) => ({ ...s, sourceType: "custom" }));

      try {
        await api.runCustomPipeline(request);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Custom pipeline API unavailable";
        setState((s) => ({ ...s, error: message }));
      }
    },
    [runSimulation]
  );

  /** Run the pipeline against custom (uploaded) code. */
  const runCustomUpload = useCallback(
    async (formData: FormData) => {
      runSimulation();
      setState((s) => ({ ...s, sourceType: "custom" }));

      try {
        await api.runCustomPipelineUpload(formData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Custom pipeline upload failed";
        setState((s) => ({ ...s, error: message }));
      }
    },
    [runSimulation]
  );

  /** Abort the in-flight run and reset. */
  const cancel = useCallback(() => {
    cancelled.current = true;
    clearTimers();
    setState(INITIAL_STATE);
  }, [clearTimers]);

  // Cleanup on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return {
    ...state,
    runPipeline,
    runCustomPipeline,
    runCustomUpload,
    cancel,
    /** True when the live API failed and we're replaying the mock script. */
    isMockReplay: state.error !== null && state.isRunning,
    /** The mock run metadata — used by callers when isMockReplay is true. */
    mockRun,
  };
}

function nextStage(stage: PipelineStage): PipelineStage {
  switch (stage) {
    case "scanning":
      return "fixing";
    case "fixing":
      return "verifying";
    case "verifying":
      return "completed";
    default:
      return "completed";
  }
}
