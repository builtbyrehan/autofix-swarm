export interface HealthStatus {
  status: string;
  version: string;
  codex_available: boolean;
  gpt_available: boolean;
  database_connected: boolean;
  timestamp: string;
}

export interface Issue {
  id: string;
  file: string;
  line_range: {
    start: number;
    end: number;
  };
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  detectors: string[];
  latency_ms?: number;
}

export interface Fix {
  fix_id: string;
  issue_id: string;
  status: "succeeded" | "failed" | "blocked" | "rejected";
  codex_live: boolean;
  summary: string;
  changed_files: string[];
  diff_preview?: string;
  artifact_path?: string;
  duration_seconds: number;
  failure_reason?: string;
  timestamp: string;
}

export interface Verdict {
  verdict_id: string;
  fix_id: string;
  issue_id: string;
  status: string;
  tests_passed: boolean;
  explanation: string;
  confidence: number;
  duration_seconds: number;
  timestamp: string;
}

export interface PipelineRun {
  run_id: string;
  status: "idle" | "scanning" | "fixing" | "verifying" | "completed" | "failed";
  issues_found: number;
  fixes_attempted: number;
  fixes_succeeded: number;
  verifications_passed: number;
  total_duration_seconds: number;
  message?: string;
  timestamp: string;
  started_at?: string;
  completed_at?: string;
}

export interface PipelineResult {
  run_id: string;
  status: string;
  scan_result?: {
    scan_id: string;
    status: string;
    issues_found: number;
    duration_seconds: number;
    message: string;
  };
  fix_results: Fix[];
  verify_results: Verdict[];
  total_duration_seconds: number;
  started_at: string;
  completed_at?: string;
}

export interface ScanRequest {
  repo_path?: string;
  use_semgrep?: boolean;
  use_gpt?: boolean;
  max_issues?: number;
}

export interface PipelineRunRequest {
  repo_path?: string;
  use_semgrep?: boolean;
  use_gpt?: boolean;
  max_issues?: number;
  auto_fix_threshold?: number;
}

export interface CustomCodeRunRequest {
  code?: string;
  repo_path?: string;
  use_semgrep?: boolean;
  use_gpt?: boolean;
  max_issues?: number;
  language?: string;
}

export type DataSource = "live" | "cached" | "mock" | "demo";
export type PipelineStage = "idle" | "scanning" | "fixing" | "verifying" | "completed";

export type SeverityLevel = "critical" | "high" | "medium" | "low";

export interface EvalScores {
  bugs_planted: number;
  bugs_found: number;
  detection_rate: number;
  verified_fixes_passed: number;
  fix_success_rate: number;
  false_positive_count: number;
  average_recorded_latency_ms: number;
}

export type AgentName = "watcher" | "codex" | "reviewer";

export interface AgentLogEntry {
  id: string;
  ts: string;
  timestamp?: string;
  level: "info" | "warn" | "error" | "debug" | "success";
  agent: AgentName;
  stage?: string;
  message: string;
}
