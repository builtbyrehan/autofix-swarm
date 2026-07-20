/* ============================================================
   AutoFix Swarm — typed API client
   Thin wrapper around fetch with the base URL, JSON handling, and
   typed methods for every backend endpoint. Used by the SWR hooks.
   ============================================================ */

import type {
  CustomCodeRunRequest,
  Fix,
  HealthStatus,
  Issue,
  PipelineRun,
  PipelineRunRequest,
  PipelineResult,
  Verdict,
} from "@/types";

/** Base API URL — falls back to localhost:8000 for local dev. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Error with status code + body for callers to differentiate 404 vs 500 etc. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  // 204 / empty body — return null cast; common for DELETE.
  if (res.status === 204) return null as T;

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(
      `API ${res.status} on ${path}`,
      res.status,
      body ?? text
    );
  }
  return body as T;
}

/** Tolerant JSON parse — never throws (returns null on bad bodies). */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ============================================================
   Endpoints — grouped by tag to mirror backend/main.py.
   ============================================================ */

export const api = {
  /* ---------- General ---------- */
  health: () => request<HealthStatus>("/health"),

  /* ---------- Agents ---------- */
  scan: (body: { repo_path?: string; use_semgrep?: boolean; use_gpt?: boolean; max_issues?: number }) =>
    request<{ scan_id: string; status: string; issues_found: number; duration_seconds: number; message: string }>("/scan", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  fix: (body: { issue_id: string; issue_data?: Record<string, unknown> }) =>
    request<{ fix_id: string }>("/fix", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verify: (body: { fix_id: string }) =>
    request<{ verdict_id: string }>("/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ---------- Pipeline ---------- */
  runPipeline: (body: PipelineRunRequest) =>
    request<PipelineRun>("/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ---------- Custom Code ---------- */
  runCustomPipeline: (body: CustomCodeRunRequest) =>
    request<PipelineRun>("/run/custom", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  runCustomPipelineUpload: (formData: FormData) => {
    const url = `${API_URL}/run/custom/upload`;
    return fetch(url, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new ApiError(
          `API ${res.status} on /run/custom/upload`,
          res.status,
          safeJson(text) ?? text
        );
      }
      return res.json() as Promise<PipelineRun>;
    });
  },

  /* ---------- Results ---------- */
  getLatestResult: () => request<PipelineResult>("/results/latest"),
  getResult: (runId: string) => request<PipelineResult>(`/results/${runId}`),
  getIssues: (runId: string) =>
    request<{ run_id: string; issues: Issue[]; count: number }>(`/issues/${runId}`),
  getFixes: (runId: string) =>
    request<{ run_id: string; fixes: Fix[]; count: number }>(`/fixes/${runId}`),
  getVerdicts: (runId: string) =>
    request<{ run_id: string; verdicts: Verdict[]; count: number }>(`/verdicts/${runId}`),

  /* ---------- Demo cache (fallback replay) ---------- */
  getCachedRun: () => request<Record<string, unknown>>("/demo/cached"),
  listCachedRuns: () => request<{ runs: unknown[]; count: number }>("/demo/cached/list"),
};
