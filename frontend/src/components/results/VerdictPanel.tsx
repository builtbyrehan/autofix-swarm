"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Shield } from "lucide-react";
import { HudPanel, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DURATION, ease, EASE } from "@/lib/easing";
import { formatDuration } from "@/lib/format";
import type { Verdict } from "@/types";

interface VerdictPanelProps {
  verdicts: Verdict[];
}

export function VerdictPanel({ verdicts }: VerdictPanelProps) {
  const passed = verdicts.filter((v) => v.tests_passed);
  const failed = verdicts.filter((v) => !v.tests_passed);
  const passRate = verdicts.length > 0 ? (passed.length / verdicts.length) * 100 : 0;

  return (
    <HudPanel brackets className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-success" />
          <p className="telemetry-label">Verification Summary</p>
        </div>
        <Badge variant={passRate >= 80 ? "emerald" : passRate >= 50 ? "warning" : "error"}>
          {passRate.toFixed(0)}% pass rate
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-bg-1/30 p-3 text-center">
          <p className="text-lg font-bold text-success tabular-nums">{passed.length}</p>
          <p className="telemetry-label text-[10px]">Passed</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-1/30 p-3 text-center">
          <p className="text-lg font-bold text-error tabular-nums">{failed.length}</p>
          <p className="telemetry-label text-[10px]">Failed</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-1/30 p-3 text-center">
          <p className="text-lg font-bold text-watcher tabular-nums">{verdicts.length}</p>
          <p className="telemetry-label text-[10px]">Total</p>
        </div>
      </div>

      <div className="space-y-2">
        {verdicts.map((verdict, i) => (
          <motion.div
            key={verdict.verdict_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: DURATION.fast,
              ease: ease(EASE.primary),
              delay: 0.03 * i,
            }}
            className={cn(
              "rounded-lg border p-3",
              verdict.tests_passed
                ? "border-success/30 bg-success/5"
                : "border-error/30 bg-error/5"
            )}
          >
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {verdict.tests_passed ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-error" />
                )}
                <span className="font-mono text-xs text-muted-foreground">
                  {verdict.issue_id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {verdict.duration_seconds != null && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatDuration(verdict.duration_seconds)}
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {Math.round(verdict.confidence * 100)}%
                </span>
              </div>
            </div>
            <p className="text-sm text-foreground/80">{verdict.explanation}</p>
          </motion.div>
        ))}
      </div>
    </HudPanel>
  );
}
