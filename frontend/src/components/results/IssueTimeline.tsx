"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bug, ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { useState } from "react";
import { HudPanel, SeverityBadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DURATION, ease, EASE } from "@/lib/easing";
import type { Issue, Fix, Verdict } from "@/types";

interface IssueTimelineProps {
  issues: Issue[];
  fixes: Fix[];
  verdicts: Verdict[];
}

export function IssueTimeline({ issues, fixes, verdicts }: IssueTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const getFix = (issueId: string) => fixes.find((f) => f.issue_id === issueId);
  const getVerdict = (issueId: string) => verdicts.find((v) => v.issue_id === issueId);

  return (
    <HudPanel brackets className="p-5">
      <p className="telemetry-label mb-4">
        Issue Timeline ({issues.length})
      </p>

      <div className="relative space-y-0">
        {/* Vertical timeline line */}
        <div className="absolute bottom-0 left-[11px] top-0 w-px bg-border" />

        <AnimatePresence>
          {issues.map((issue, i) => {
            const fix = getFix(issue.id);
            const verdict = getVerdict(issue.id);
            const isExpanded = expanded === issue.id;

            return (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: DURATION.base,
                  ease: ease(EASE.primary),
                  delay: 0.05 * i,
                }}
                className="relative pl-8 pb-4"
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-[6px] top-1.5 h-3 w-3 rounded-full border-2",
                    verdict?.tests_passed
                      ? "border-success bg-success/20"
                      : fix
                        ? "border-warning bg-warning/20"
                        : "border-error bg-error/20"
                  )}
                />

                {/* Clickable card */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : issue.id)}
                  className="cursor-pointer rounded-lg border border-border bg-bg-1/30 p-3 transition-colors hover:border-watcher/30"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={issue.severity} />
                      <code className="text-xs text-muted-foreground">
                        {issue.file}
                      </code>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        L{issue.line_range.start}-{issue.line_range.end}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {Math.round(issue.confidence * 100)}%
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-foreground/80">{issue.description}</p>

                  {/* Expanded details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: DURATION.fast }}
                      className="mt-3 space-y-3 overflow-hidden"
                    >
                      {fix && (
                        <div className="rounded bg-bg-0/60 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <FileCode className="h-3.5 w-3.5 text-codex" />
                            <span className="text-xs font-semibold text-codex">
                              Fix
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {fix.duration_seconds.toFixed(1)}s
                            </span>
                          </div>
                          <p className="text-sm text-foreground/80">
                            {fix.summary}
                          </p>
                          {fix.changed_files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {fix.changed_files.map((f, i) => (
                                <code
                                  key={i}
                                  className="rounded bg-codex/8 px-1.5 py-0.5 font-mono text-[10px] text-codex"
                                >
                                  {f}
                                </code>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {verdict && (
                        <div
                          className={cn(
                            "rounded p-3",
                            verdict.tests_passed
                              ? "bg-success/5"
                              : "bg-error/5"
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            {verdict.tests_passed ? (
                              <Bug className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Bug className="h-3.5 w-3.5 text-error" />
                            )}
                            <span className="text-xs font-semibold text-foreground">
                              Verification
                            </span>
                          </div>
                          <p className="text-sm text-foreground/80">
                            {verdict.explanation}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </HudPanel>
  );
}
