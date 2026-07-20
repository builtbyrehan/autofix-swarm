"use client";

import { cn } from "@/lib/utils";

interface RunProgressBarProps {
  progress: number;
  stage: string;
  visible: boolean;
}

const stageAccent: Record<string, string> = {
  idle: "bg-muted-foreground",
  scanning: "bg-watcher",
  fixing: "bg-codex",
  verifying: "bg-reviewer",
  completed: "bg-success",
  failed: "bg-error",
};

export function RunProgressBar({
  progress,
  stage,
  visible,
}: RunProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const accent = stageAccent[stage] ?? "bg-watcher";

  return (
    <div
      className={cn(
        "h-1 w-full overflow-hidden rounded-full bg-border transition-opacity duration-500",
        "relative",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Pipeline run progress: ${pct}%`}
    >
      {/* Glow trail behind the bar */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-sm opacity-50",
          accent
        )}
        style={{
          width: `${pct}%`,
          transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      {/* Main bar */}
      <div
        className={cn(
          "relative h-full rounded-full transition-all duration-500",
          accent
        )}
        style={{
          width: `${pct}%`,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}
