/* ============================================================
   Formatting helpers — one source of truth for how durations,
   timestamps, severities, confidences, and run IDs render.
   Components import these instead of hand-rolling per-instance.
   ============================================================ */

import type { SeverityLevel } from "@/types";

/** Human-readable duration: "1.4s", "2m 13s", "1h 4m". */
export function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds === 0
      ? `${minutes}m`
      : `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/** Latency in ms rendered as a compact "234ms" / "1.2s". */
export function formatLatency(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return formatDuration(ms / 1000);
}

/** Timestamp as "Jul 18, 14:03". Stable across the app. */
export function formatTimestamp(
  timestamp: string | number | Date | undefined
): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative time: "just now", "3m ago", "2h ago", "Jul 18". */
export function formatRelativeTime(
  timestamp: string | number | Date | undefined
): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return formatTimestamp(timestamp);
}

/** Confidence 0–1 → "87%". Returns "—" for invalid input. */
export function formatConfidence(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Pipeline run ID truncated to its first segment for display. */
export function formatRunId(runId: string | undefined): string {
  if (!runId) return "—";
  // run IDs look like "run_<uuid>" or similar; show first 8 chars after prefix.
  const short = runId.replace(/^run_/, "").slice(0, 8);
  return short || runId.slice(0, 8);
}

/** Normalize any severity-ish string to the canonical enum. */
export function normalizeSeverity(
  severity: string | undefined
): SeverityLevel {
  const s = String(severity ?? "").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  return "medium";
}

/** Severity rank for sorting (critical first). */
export const severityRank: Record<SeverityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Tailwind text/bg classes per severity — kept here so all components
 *  render the same severity look. The Badge component handles most cases;
 *  these are for contexts that need raw classes (e.g. inline icons). */
export const severityText: Record<SeverityLevel, string> = {
  critical: "text-critical",
  high: "text-error",
  medium: "text-warning",
  low: "text-muted-foreground",
};

/** Rate 0–1 → percentage with no decimals. 0.875 → "88%". */
export function formatRate(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}
