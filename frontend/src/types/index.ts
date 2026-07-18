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
