"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { mockFixes, mockIssues, mockRun, mockVerdicts } from "@/lib/mockData";
import type { DataSource, Fix, Issue, PipelineRun, Verdict } from "@/types";

/**
 * useLatestRun — fetches the latest pipeline run plus its issues, fixes,
 * and verdicts in parallel, with a three-tier fallback chain:
 *
 *   1. live   — GET /results/latest + /issues /fixes /verdicts for that run
 *   2. cached — GET /demo/cached  (backend's recorded successful run)
 *   3. mock   — built-in offline dataset (mirrors the 7 seeded bugs)
 *
 * `dataSource` tells callers which tier produced the data so the UI can
 * badge it correctly. Per the project hard rule: cached/mock must NEVER
 * be presented as a live GPT-5.6 run.
 */

export interface LatestRunData {
  run: PipelineRun | null;
  issues: Issue[];
  fixes: Fix[];
  verdicts: Verdict[];
  dataSource: DataSource;
}

/** Try the live path; return null if anything's missing/unreachable. */
async function fetchLive(): Promise<LatestRunData | null> {
  try {
    const runResult = await api.getLatestResult();
    const runId = (runResult as { run_id?: string }).run_id;
    if (!runId) return null;

    // Run shape from /results/latest may be partial; coerce into PipelineRun.
    const run: PipelineRun = {
      run_id: runId,
      status: ((runResult as { status?: string }).status ?? "completed") as PipelineRun["status"],
      issues_found: (runResult as { issues_found?: number }).issues_found ?? 0,
      fixes_attempted: 0,
      fixes_succeeded: 0,
      verifications_passed: 0,
      total_duration_seconds:
        (runResult as { total_duration_seconds?: number })
          .total_duration_seconds ?? 0,
      timestamp: (runResult as { started_at?: string }).started_at ?? new Date().toISOString(),
      started_at: (runResult as { started_at?: string }).started_at,
      completed_at: (runResult as { completed_at?: string }).completed_at,
    };

    const [issuesR, fixesR, verdictsR] = await Promise.allSettled([
      api.getIssues(runId),
      api.getFixes(runId),
      api.getVerdicts(runId),
    ]);

    const issues =
      issuesR.status === "fulfilled" ? issuesR.value.issues : [];
    const fixes = fixesR.status === "fulfilled" ? fixesR.value.fixes : [];
    const resolvedVerdicts =
      verdictsR.status === "fulfilled" ? verdictsR.value.verdicts : [];

    // Aggregate counts if the run response didn't carry them.
    if (!run.fixes_attempted) {
      run.fixes_attempted = fixes.length;
      run.fixes_succeeded = fixes.filter(
        (f) => f.status === "succeeded"
      ).length;
    }
    if (!run.verifications_passed) {
      run.verifications_passed = resolvedVerdicts.filter(
        (v) => v.tests_passed
      ).length;
    }

    return {
      run,
      issues,
      fixes,
      verdicts: resolvedVerdicts,
      dataSource: "live",
    };
  } catch {
    return null;
  }
}

/** Try the cached demo path; return null if unavailable. */
async function fetchCached(): Promise<LatestRunData | null> {
  try {
    const cached = (await api.getCachedRun()) as {
      run?: PipelineRun;
      issues?: Issue[];
      fixes?: Fix[];
      verdicts?: Verdict[];
    };
    if (!cached || !cached.run) return null;
    return {
      run: cached.run,
      issues: cached.issues ?? [],
      fixes: cached.fixes ?? [],
      verdicts: cached.verdicts ?? [],
      dataSource: "cached",
    };
  } catch {
    return null;
  }
}

/** The mock fallback — always available, always badged OFFLINE. */
function mockData(): LatestRunData {
  return {
    run: mockRun,
    issues: mockIssues,
    fixes: mockFixes,
    verdicts: mockVerdicts,
    dataSource: "mock",
  };
}

async function fetcher(): Promise<LatestRunData> {
  // Chain: live → cached → mock. Whichever returns first non-null wins.
  const live = await fetchLive();
  if (live && (live.issues.length > 0 || live.run?.issues_found)) {
    return live;
  }
  const cached = await fetchCached();
  if (cached && (cached.issues.length > 0 || cached.run?.issues_found)) {
    return cached;
  }
  return mockData();
}

export function useLatestRun() {
  const { data, error, isLoading, mutate } = useSWR<LatestRunData>(
    "latest-run",
    fetcher,
    {
      revalidateOnFocus: false, // we don't want to bounce data sources on tab switch
      shouldRetryOnError: false,
    }
  );

  return {
    data: data ?? null,
    run: data?.run ?? null,
    issues: data?.issues ?? [],
    fixes: data?.fixes ?? [],
    verdicts: data?.verdicts ?? [],
    dataSource: data?.dataSource ?? "mock",
    isError: !!error,
    isLoading,
    /** Force a refetch (e.g. after a pipeline run completes). */
    refresh: mutate,
  };
}
