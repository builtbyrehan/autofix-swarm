"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { HudPanel, Badge, AnimatedNumber } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDuration, formatTimestamp } from "@/lib/format";
import type { PipelineRun, DataSource } from "@/types";

interface RunSummaryProps {
  run: PipelineRun;
  dataSource: DataSource;
}

const sourceVariant: Record<DataSource, "cyan" | "warning" | "neutral"> = {
  live: "cyan",
  cached: "warning",
  mock: "neutral",
  demo: "neutral",
};

export function RunSummary({ run, dataSource }: RunSummaryProps) {
  const succeeded = run.status === "completed";
  const failed = run.status === "failed";

  return (
    <HudPanel brackets className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {succeeded ? (
            <CheckCircle2 className="h-6 w-6 text-success" />
          ) : failed ? (
            <XCircle className="h-6 w-6 text-error" />
          ) : (
            <Clock className="h-6 w-6 text-watcher" />
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Run {run.run_id.slice(0, 8)}
            </h1>
            <p className="telemetry-label text-[10px]">
              {run.status.toUpperCase()} ·{" "}
              {run.started_at ? formatTimestamp(run.started_at) : "—"}
            </p>
          </div>
        </div>
        <Badge variant={sourceVariant[dataSource]}>
          {dataSource === "live" ? "LIVE" : dataSource === "cached" ? "CACHED" : "OFFLINE"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label="Issues Found" value={run.issues_found} color="text-error" />
        <SummaryTile label="Fixes Attempted" value={run.fixes_attempted} color="text-warning" />
        <SummaryTile label="Fixes Verified" value={run.fixes_succeeded} color="text-success" />
        <SummaryTile
          label="Duration"
          value={formatDuration(run.total_duration_seconds)}
          color="text-watcher"
          raw
        />
      </div>
    </HudPanel>
  );
}

function SummaryTile({
  label,
  value,
  color,
  raw,
}: {
  label: string;
  value: number | string;
  color: string;
  raw?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-1/30 p-3">
      <p className={cn("text-xl font-bold tabular-nums", color)}>
        {raw ? value : <AnimatedNumber value={value as number} />}
      </p>
      <p className="telemetry-label mt-1">{label}</p>
    </div>
  );
}
