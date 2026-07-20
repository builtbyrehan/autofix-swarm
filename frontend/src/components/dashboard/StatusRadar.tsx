"use client";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/types";

interface StatusRadarProps {
  stage: PipelineStage;
}

const stages = [
  { key: "scanning", label: "Detect", color: "hsl(199 89% 48%)" },
  { key: "fixing", label: "Fix", color: "hsl(173 80% 45%)" },
  { key: "verifying", label: "Verify", color: "hsl(158 64% 45%)" },
];

export function StatusRadar({ stage }: StatusRadarProps) {
  const stageOrder = ["idle", "scanning", "fixing", "verifying", "completed"];
  const currentIdx = stageOrder.indexOf(stage);
  const isComplete = stage === "completed";

  return (
    <div className="flex items-center gap-6">
      {stages.map((s, i) => {
        const stageIdx = stageOrder.indexOf(s.key);
        const active = currentIdx === stageIdx;
        const completed = currentIdx > stageIdx || isComplete;

        return (
          <div
            key={s.key}
            className="relative flex items-center gap-2"
          >
            {/* Holographic ring indicator */}
            <span className="relative flex h-5 w-5 items-center justify-center">
              {/* Outer ring */}
              <span
                className={cn(
                  "absolute inset-0 rounded-full border transition-all duration-500",
                  completed
                    ? "border-success shadow-[0_0_6px_hsl(var(--success))]"
                    : active
                      ? "border-watcher shadow-[0_0_6px_hsl(var(--agent-watcher))]"
                      : "border-muted-foreground/20"
                )}
                style={active && !completed ? { borderColor: s.color, boxShadow: `0 0 6px ${s.color}` } : undefined}
              />
              {/* Sweep arc (active only) */}
              {active && !completed && (
                <span
                  className="radar-sweep absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(from -90deg, transparent 60%, ${s.color} 90%, transparent 100%)`,
                    maskImage: "radial-gradient(circle at center, transparent 35%, black 40%)",
                    WebkitMaskImage: "radial-gradient(circle at center, transparent 35%, black 40%)",
                  }}
                />
              )}
              {/* Center dot */}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-500",
                  completed
                    ? "bg-success"
                    : active
                      ? "bg-watcher"
                      : "bg-muted-foreground/30"
                )}
                style={active && !completed ? { backgroundColor: s.color } : undefined}
              />
            </span>

            {/* Label */}
            <span
              className={cn(
                "font-mono text-[11px] uppercase tracking-wider transition-all duration-300",
                completed
                  ? "text-success"
                  : active
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground/40"
              )}
            >
              {s.label}
            </span>

            {/* Connector line to next stage */}
            {i < stages.length - 1 && (
              <span
                className={cn(
                  "ml-2 h-px w-4 transition-all duration-500",
                  completed || (active && stageIdx < stageOrder.length)
                    ? "bg-border"
                    : "bg-muted-foreground/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
