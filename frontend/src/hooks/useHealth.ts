"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { HealthStatus } from "@/types";

/**
 * useHealth — polls /health every 15s so the status badges in the header
 * stay current without manual refresh. SWR handles dedup, retry, and
 * optimistic re-focus.
 *
 * Returns `null` while loading or on error so consumers can render an
 * "unknown" state instead of stale data.
 */

const HEALTH_REFRESH_MS = 15_000;

async function fetcher(): Promise<HealthStatus | null> {
  try {
    return await api.health();
  } catch {
    return null;
  }
}

export function useHealth() {
  const { data, error, isLoading } = useSWR<HealthStatus | null>(
    "health",
    fetcher,
    {
      refreshInterval: HEALTH_REFRESH_MS,
      revalidateOnFocus: true,
      shouldRetryOnError: false, // backend may be down during mock demos
    }
  );

  return {
    health: data ?? null,
    isError: !!error,
    isLoading,
    /** True only when the API has answered at least once with a value. */
    isReachable: data != null,
  };
}
