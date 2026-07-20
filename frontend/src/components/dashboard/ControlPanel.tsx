"use client";

import { Play, Square, Terminal, Code, RefreshCw } from "lucide-react";
import { Button, HudPanel, Badge, StatusDot } from "@/components/ui";
import type { PipelineRunState } from "@/hooks/usePipelineRun";
import type { DataSource } from "@/types";

interface ControlPanelProps {
  state: PipelineRunState;
  dataSource: DataSource;
  onRun: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  codeSource?: "demo" | "custom";
}

const sourceLabel: Record<DataSource, string> = {
  live: "LIVE",
  cached: "CACHED",
  mock: "OFFLINE",
  demo: "DEMO",
};

const sourceVariant: Record<DataSource, "cyan" | "warning" | "neutral"> = {
  live: "cyan",
  cached: "warning",
  mock: "neutral",
  demo: "neutral",
};

export function ControlPanel({
  state,
  dataSource,
  onRun,
  onCancel,
  onRefresh,
  codeSource = "demo",
}: ControlPanelProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-watcher/10">
          <Terminal className="h-5 w-5 text-watcher" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Command Center</h1>
          <p className="telemetry-label text-[10px]">
            Pipeline Orchestration
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Stage badge */}
        {state.stage !== "idle" && (
          <Badge variant="cyan">{state.stage.toUpperCase()}</Badge>
        )}

        {/* Custom source badge */}
        {codeSource === "custom" && !state.isRunning && (
          <Badge variant="teal">
            <Code className="h-3 w-3" />
            YOUR CODE
          </Badge>
        )}

        {/* Data source badge */}
        <Badge variant={sourceVariant[dataSource]}>
          <StatusDot
            state={dataSource === "live" ? "success" : dataSource === "cached" ? "warning" : "idle"}
            pulse={false}
          />
          {sourceLabel[dataSource]}
        </Badge>

        {/* Refresh */}
        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh results">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Run / Cancel */}
        {state.isRunning ? (
          <Button variant="danger" size="md" onClick={onCancel}>
            <Square className="h-4 w-4" />
            Cancel
          </Button>
        ) : (
          <div className="relative">
            {/* Pulsing glow ring behind the Run button */}
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-watcher/20 to-codex/20 blur-md animate-pulse" />
            <Button variant="primary" size="md" onClick={onRun} className="relative">
              <Play className="h-4 w-4" />
              {codeSource === "custom" ? "Run on Your Code" : "Run Pipeline"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
