"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HudPanel } from "@/components/ui";
import { DURATION, EASE, ease } from "@/lib/easing";
import type { PipelineRun } from "@/types";

interface LiveMetricsProps {
  run: PipelineRun | null;
  isRunning: boolean;
}

interface MetricDef {
  key: keyof PipelineRun;
  label: string;
  color: string;
  suffix?: string;
  decimals?: number;
}

const metrics: MetricDef[] = [
  { key: "issues_found", label: "Issues Found", color: "hsl(0 72% 51%)" },
  { key: "fixes_attempted", label: "Fixes Attempted", color: "hsl(38 92% 50%)" },
  { key: "fixes_succeeded", label: "Fixes Verified", color: "hsl(158 64% 45%)" },
  { key: "verifications_passed", label: "Tests Passed", color: "hsl(173 80% 45%)" },
  { key: "total_duration_seconds", label: "Duration", color: "hsl(199 89% 48%)", decimals: 1, suffix: "s" },
];

/** Full circle circumference — used for dashoffset calculation. */
const CIRCUMFERENCE = 2 * Math.PI * 36;

function ArcGauge({
  value,
  max = 100,
  color,
  label,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  max?: number;
  color: string;
  label: string;
  suffix?: string;
  decimals?: number;
}) {
  const ratio = Math.min(1, max > 0 ? value / max : 0);
  const offset = CIRCUMFERENCE * (1 - ratio);
  const displayed = typeof value === "number" ? value.toFixed(decimals) : "0";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width="88"
        height="56"
        viewBox="0 0 88 56"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Background arc */}
        <path
          d="M 6 50 A 38 38 0 0 1 82 50"
          fill="none"
          stroke="hsl(var(--border) / 0.4)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d="M 6 50 A 38 38 0 0 1 82 50"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          style={{
            strokeDashoffset: offset,
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        {/* Value text */}
        <text
          x="44"
          y="42"
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontFamily="var(--font-mono)"
          fontSize="16"
          fontWeight="700"
        >
          {displayed}
          {suffix && (
            <tspan fill="hsl(var(--muted-foreground))" fontSize="10">
              {suffix}
            </tspan>
          )}
        </text>
      </svg>
      <p className="telemetry-label text-[9px] leading-tight">{label}</p>
    </div>
  );
}

export function LiveMetrics({ run, isRunning }: LiveMetricsProps) {
  if (!run) return null;

  return (
    <HudPanel brackets className="p-4" hoverGlow>
      <p className="telemetry-label mb-4">Run Metrics</p>
      <div className="grid grid-cols-5 gap-2">
        {metrics.map((m, i) => {
          const rawValue = run ? (run[m.key] as number) : 0;
          return (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: DURATION.base,
                ease: ease(EASE.primary),
                delay: 0.05 * i,
              }}
            >
              <ArcGauge
                value={rawValue}
                max={
                  m.key === "issues_found"
                    ? Math.max(rawValue, 10)
                    : m.key === "total_duration_seconds"
                      ? Math.max(rawValue, 60)
                      : Math.max(rawValue, 10)
                }
                color={m.color}
                label={m.label}
                suffix={m.suffix ?? ""}
                decimals={m.decimals ?? 0}
              />
            </motion.div>
          );
        })}
      </div>
    </HudPanel>
  );
}
