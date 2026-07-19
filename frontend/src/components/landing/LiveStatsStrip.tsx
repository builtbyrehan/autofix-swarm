"use client";

import { motion } from "framer-motion";
import { Bug, CheckCircle2, Clock, Wrench } from "lucide-react";
import { useLatestRun } from "@/hooks/useLatestRun";
import { AnimatedNumber, HudPanel, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DURATION, EASE, ease } from "@/lib/easing";

/**
 * LiveStatsStrip — shows latest pipeline run metrics with animated counters.
 * Uses the useLatestRun hook which falls back through live → cached → mock.
 * Always displays the dataSource badge per the hard rule.
 */

const stats = [
  {
    key: "issues" as const,
    label: "Issues Found",
    icon: Bug,
    iconColor: "text-error",
    emptyDash: true,
  },
  {
    key: "attempted" as const,
    label: "Fixes Attempted",
    icon: Wrench,
    iconColor: "text-warning",
    emptyDash: true,
  },
  {
    key: "succeeded" as const,
    label: "Fixes Verified",
    icon: CheckCircle2,
    iconColor: "text-success",
    emptyDash: true,
  },
  {
    key: "duration" as const,
    label: "Total Duration",
    icon: Clock,
    iconColor: "text-watcher",
    emptyDash: false,
  },
] as const;

function statValue(run: NonNullable<ReturnType<typeof useLatestRun>["run"]>, key: typeof stats[number]["key"]): number {
  switch (key) {
    case "issues": return run.issues_found;
    case "attempted": return run.fixes_attempted;
    case "succeeded": return run.fixes_succeeded;
    case "duration": return Math.round(run.total_duration_seconds * 10) / 10;
  }
}

const sourceVariant: Record<string, "cyan" | "warning" | "neutral"> = {
  live: "cyan",
  cached: "warning",
  mock: "neutral",
  demo: "neutral",
};

export function LiveStatsStrip() {
  const { run, dataSource, isLoading } = useLatestRun();
  const hasData = run && (run.issues_found > 0 || run.status === "completed");

  return (
    <section className="py-8">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <p className="telemetry-label">Latest Pipeline Run</p>
          {hasData && (
            <Badge variant={sourceVariant[dataSource]}>
              {dataSource === "live" ? "LIVE" : dataSource === "cached" ? "CACHED" : "OFFLINE"}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const value = run ? statValue(run, stat.key) : 0;

            return (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: DURATION.base,
                  ease: ease(EASE.primary),
                  delay: 0.1 * i,
                }}
              >
                <HudPanel brackets tilt className="h-full p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={cn("h-5 w-5", stat.iconColor)} />
                    {isLoading ? (
                      <span className="h-7 w-12 animate-pulse rounded bg-muted/40" />
                    ) : (
                      <span className="text-display tabular-nums text-foreground">
                        {hasData || !stat.emptyDash ? (
                          <AnimatedNumber
                            value={value}
                            decimals={stat.key === "duration" ? 1 : 0}
                            suffix={stat.key === "duration" ? "s" : ""}
                            disabled={!hasData}
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                    )}
                  </div>
                  <p className="telemetry-label">{stat.label}</p>
                </HudPanel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
