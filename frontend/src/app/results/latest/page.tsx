"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Terminal } from "lucide-react";
import { useLatestRun } from "@/hooks/useLatestRun";
import {
  RunSummary,
  EvalScores,
  IssueTimeline,
  VerdictPanel,
} from "@/components/results";
import { Button, Skeleton } from "@/components/ui";
import { DURATION, ease, EASE } from "@/lib/easing";

export default function LatestResultsPage() {
  const { run, issues, fixes, verdicts, dataSource, isLoading, refresh } =
    useLatestRun();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-8 h-32 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast, ease: ease(EASE.primary) }}
        className="mb-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </motion.div>

      {/* Run Summary */}
      {run && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: ease(EASE.primary) }}
          className="mb-8"
        >
          <RunSummary run={run} dataSource={dataSource} />
        </motion.div>
      )}

      {/* Eval Scores */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: ease(EASE.primary), delay: 0.05 }}
        className="mb-8"
      >
        <EvalScores />
      </motion.div>

      {/* Issue Timeline + Verdicts — two-column on large screens */}
      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DURATION.base, ease: ease(EASE.primary), delay: 0.1 }}
          className="lg:col-span-3"
        >
          <IssueTimeline issues={issues} fixes={fixes} verdicts={verdicts} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DURATION.base, ease: ease(EASE.primary), delay: 0.15 }}
          className="lg:col-span-2"
        >
          <VerdictPanel verdicts={verdicts} />
        </motion.div>
      </div>

      {/* Empty State */}
      {!run && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Terminal className="mb-4 h-16 w-16 text-watcher opacity-40" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No Results Available
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Run a pipeline first to see results here.
          </p>
          <Button variant="primary" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
