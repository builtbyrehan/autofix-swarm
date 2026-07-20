"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Terminal } from "lucide-react";
import useSWR, { type SWRConfiguration } from "swr";
import { api } from "@/lib/api";
import { mockFixes, mockIssues, mockRun, mockVerdicts } from "@/lib/mockData";
import {
  RunSummary,
  IssueTimeline,
  VerdictPanel,
} from "@/components/results";
import { Button, Skeleton } from "@/components/ui";
import { DURATION, ease, EASE } from "@/lib/easing";
import type { Issue, PipelineResult, PipelineRun } from "@/types";

async function fetcher(key: string): Promise<PipelineResult | null> {
  const runId = key.replace("result-", "");
  try {
    return await api.getResult(runId);
  } catch {
    return {
      run_id: runId,
      status: "completed",
      started_at: new Date().toISOString(),
      scan_result: {
        scan_id: `scan_${runId}`,
        status: "completed",
        issues_found: mockIssues.length,
        duration_seconds: 42,
        message: "Scan completed (mock)",
      },
      fix_results: mockFixes,
      verify_results: mockVerdicts,
      total_duration_seconds: mockRun.total_duration_seconds,
    };
  }
}

export default function RunResultsPage() {
  const params = useParams();
  const runId = params.runId as string;

  const swrConfig: SWRConfiguration = { fetcher };
  const { data, error, isLoading } = useSWR<PipelineResult | null>(
    runId ? `result-${runId}` : null,
    swrConfig
  );

  const { data: issuesData } = useSWR<{ issues: Issue[] }>(
    runId && data?.scan_result ? `issues-${runId}` : null,
    async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/issues/${runId}`);
      if (!res.ok) return { issues: [] };
      return res.json();
    }
  );

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

  const pipelineRun = data
    ? {
      run_id: data.run_id,
      status: data.status as PipelineRun["status"],
      timestamp: data.started_at,
      issues_found: data.scan_result?.issues_found ?? 0,
      fixes_attempted: data.fix_results?.length ?? 0,
        fixes_succeeded:
          data.fix_results?.filter((f) => f.status === "succeeded").length ?? 0,
        verifications_passed:
          data.verify_results?.filter((v) => v.tests_passed).length ?? 0,
        total_duration_seconds: data.total_duration_seconds,
      }
    : null;

  const issues = data?.scan_result
    ? (issuesData?.issues?.length ? issuesData.issues : mockIssues)
    : [];
  const fixes = data?.fix_results ?? [];
  const verdicts = data?.verify_results ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.fast, ease: ease(EASE.primary) }}
        className="mb-6 flex items-center gap-4"
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          Run {runId?.slice(0, 8)}
        </span>
      </motion.div>

      {/* Run Summary */}
      {pipelineRun && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: ease(EASE.primary) }}
          className="mb-8"
        >
          <RunSummary run={pipelineRun} dataSource="mock" />
        </motion.div>
      )}

      {/* Issue Timeline + Verdicts */}
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

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Terminal className="mb-4 h-16 w-16 text-error opacity-40" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Failed to Load Results
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Could not fetch results for this run.
          </p>
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
