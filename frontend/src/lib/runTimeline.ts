/**
 * runTimeline.ts — GSAP timeline factory for the pipeline run sequence.
 *
 * Builds a single timeline that orchestrates the entire run visualization:
 *   idle → armed → scanning → fixing → verifying → completed
 *
 * Each stage exposes GSAP labels so usePipelineRun can .seek() or .progress()
 * the same timeline against real backend progress instead of guessing durations.
 *
 * One state machine consumed by both the 3D scene and the 2D pipeline graph.
 */

import gsap from "gsap";
import type { PipelineStage } from "@/types";

const noop = () => {};

/* ------------------------------------------------------------------ */
/*  Stage progression metadata                                        */
/* ------------------------------------------------------------------ */

export interface StageCallbacks {
  onArmed?: () => void;
  onScanningStart?: () => void;
  onScanningProgress?: (pct: number) => void;
  onFixingStart?: () => void;
  onFixingProgress?: (pct: number) => void;
  onVerifyingStart?: () => void;
  onVerifyingProgress?: (pct: number) => void;
  onCompleted?: () => void;
  onMetricCountUp?: (pct: number) => void;
}

export interface TimelineHandle {
  timeline: gsap.core.Timeline;
  labels: Record<string, number>;
  seek: (label: string) => void;
  progress: (pct: number) => void;
  kill: () => void;
}

/* ------------------------------------------------------------------ */
/*  Factory                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build the run timeline.
 *
 * @param stageDurations — ms per stage (defaults map to realistic demo timing)
 * @param callbacks      — stage lifecycle callbacks
 * @returns handle with the GSAP timeline + label seek/progress helpers
 */
export function buildRunTimeline(
  stageDurations: Record<PipelineStage, number> = DEFAULT_STAGE_DURATIONS,
  callbacks: StageCallbacks = {}
): TimelineHandle {
  const tl = gsap.timeline({ paused: true });
  const labels: Record<string, number> = {};

  /* ---- Armed ---- */
  labels["armed"] = tl.totalTime();
  tl.call(callbacks.onArmed ?? noop);

  /* ---- Scanning ---- */
  labels["scanning-start"] = tl.totalTime();
  tl.call(callbacks.onScanningStart ?? noop);

  const scanningDur = stageDurations.scanning / 1000;
  tl.to(
    {},
    {
      duration: scanningDur,
      ease: "none",
      onUpdate: function () {
        callbacks.onScanningProgress?.(this.progress());
      },
    }
  );
  labels["scanning-end"] = tl.totalTime();

  /* ---- Fixing ---- */
  labels["fixing-start"] = tl.totalTime();
  tl.call(callbacks.onFixingStart ?? noop);

  const fixingDur = stageDurations.fixing / 1000;
  tl.to(
    {},
    {
      duration: fixingDur,
      ease: "none",
      onUpdate: function () {
        callbacks.onFixingProgress?.(this.progress());
      },
    }
  );
  labels["fixing-end"] = tl.totalTime();

  /* ---- Verifying ---- */
  labels["verifying-start"] = tl.totalTime();
  tl.call(callbacks.onVerifyingStart ?? noop);

  const verifyingDur = stageDurations.verifying / 1000;
  tl.to(
    {},
    {
      duration: verifyingDur,
      ease: "none",
      onUpdate: function () {
        callbacks.onVerifyingProgress?.(this.progress());
      },
    }
  );
  labels["verifying-end"] = tl.totalTime();

  /* ---- Completion burst ---- */
  labels["completed"] = tl.totalTime();
  tl.call(callbacks.onCompleted ?? noop);

  /* Metric count-up runs in parallel with the last ~60% of verifying +
   * the completion burst so numbers finish counting just as the scene settles.
   */
  const metricStart = Math.max(0, labels["verifying-start"] + verifyingDur * 0.4);
  const metricDur = tl.totalTime() - metricStart;
  tl.to(
    {},
    {
      duration: metricDur,
      ease: "none",
      onUpdate: function () {
        callbacks.onMetricCountUp?.(this.progress());
      },
    },
    metricStart
  );

  return {
    timeline: tl,
    labels,
    seek(label: string) {
      const t = labels[label];
      if (t != null) tl.seek(t);
    },
    progress(pct: number) {
      tl.progress(pct);
    },
    kill() {
      tl.kill();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Default durations — chosen to feel paced for a demo                */
/* ------------------------------------------------------------------ */

const DEFAULT_STAGE_DURATIONS: Record<PipelineStage, number> = {
  idle: 0,
  scanning: 4500,
  fixing: 9000,
  verifying: 3500,
  completed: 0,
};
