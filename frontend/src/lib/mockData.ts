/* ============================================================
   Mock dataset — offline fallback so the UI is fully demoable
   without the backend running. Mirrors the 7 seeded bugs in
   seeded_repo/src/autofix_seed/ so the demo narrative is accurate.

   Per the hard rule: anything from here or the demo cache must be
   badged as OFFLINE/CACHED — never presented as a live GPT-5.6 run.
   Callers tag the result with dataSource: "mock" and the UI surfaces
   the badge. This file never lies about freshness.
   ============================================================ */

import type {
  AgentLogEntry,
  EvalScores,
  Fix,
  Issue,
  PipelineRun,
  Verdict,
} from "@/types";

const RUN_ID = "run_demo_4f2a8c91";
const STARTED_AT = "2026-07-18T14:03:22.000Z";

export const mockRun: PipelineRun = {
  run_id: RUN_ID,
  status: "completed",
  issues_found: 7,
  fixes_attempted: 6,
  fixes_succeeded: 6,
  verifications_passed: 6,
  total_duration_seconds: 184.3,
  message: "Pipeline completed (mock demo data)",
  timestamp: STARTED_AT,
  started_at: STARTED_AT,
  completed_at: "2026-07-18T14:06:26.300Z",
};

export const mockIssues: Issue[] = [
  {
    id: "bug_001",
    file: "src/autofix_seed/payments.py",
    line_range: { start: 6, end: 7 },
    description:
      "SQL query built via f-string interpolation — vulnerable to SQL injection from untrusted user input.",
    severity: "high",
    confidence: 0.97,
    detectors: ["semgrep", "gpt-5.6"],
    latency_ms: 842,
  },
  {
    id: "bug_002",
    file: "src/autofix_seed/auth.py",
    line_range: { start: 4, end: 4 },
    description:
      "Hardcoded JWT signing secret embedded directly in source code — credential leak risk.",
    severity: "high",
    confidence: 0.95,
    detectors: ["semgrep", "gpt-5.6"],
    latency_ms: 612,
  },
  {
    id: "bug_003",
    file: "src/autofix_seed/inventory.py",
    line_range: { start: 6, end: 6 },
    description:
      "Off-by-one error: range(len(items) - 1) omits the final item from iteration.",
    severity: "medium",
    confidence: 0.92,
    detectors: ["semgrep"],
    latency_ms: 421,
  },
  {
    id: "bug_004",
    file: "src/autofix_seed/shipping.py",
    line_range: { start: 6, end: 8 },
    description:
      "Strict comparison (> instead of >=) on the free-shipping threshold rejects customers at exactly the cutoff.",
    severity: "medium",
    confidence: 0.88,
    detectors: ["gpt-5.6"],
    latency_ms: 1180,
  },
  {
    id: "bug_005",
    file: "src/autofix_seed/shipping.py",
    line_range: { start: 13, end: 14 },
    description:
      "Normalized country code is computed but never used — caller still receives the raw input.",
    severity: "low",
    confidence: 0.74,
    detectors: ["semgrep"],
    latency_ms: 388,
  },
  {
    id: "bug_006",
    file: "src/autofix_seed/config.py",
    line_range: { start: 11, end: 13 },
    description:
      "Raw FileNotFoundError / JSONDecodeError leak to callers instead of the domain ConfigError — couples callers to the storage format.",
    severity: "medium",
    confidence: 0.81,
    detectors: ["gpt-5.6"],
    latency_ms: 1320,
  },
  {
    id: "bug_007",
    file: "src/autofix_seed/auth.py",
    line_range: { start: 7, end: 12 },
    description:
      "Refund authorization checks the manager role but ignores administrators — admins incorrectly denied from issuing refunds.",
    severity: "high",
    confidence: 0.9,
    detectors: ["gpt-5.6"],
    latency_ms: 1450,
  },
];

export const mockFixes: Fix[] = [
  {
    fix_id: "fix_bug_001",
    issue_id: "bug_001",
    status: "succeeded",
    codex_live: true,
    summary:
      "Replaced f-string interpolation with parameterized query using DB-API placeholders; the user input is now passed as a bind parameter rather than concatenated into the SQL text.",
    changed_files: ["src/autofix_seed/payments.py"],
    diff_preview:
      "--- a/src/autofix_seed/payments.py\n+++ b/src/autofix_seed/payments.py\n@@ -4,8 +4,7 @@\n def get_user_payments(conn, user_id):\n-    query = f\"SELECT * FROM payments WHERE user_id = {user_id}\"\n-    return conn.execute(query).fetchall()\n+    query = \"SELECT * FROM payments WHERE user_id = ?\"\n+    return conn.execute(query, (user_id,)).fetchall()",
    duration_seconds: 18.4,
    timestamp: "2026-07-18T14:04:01.000Z",
  },
  {
    fix_id: "fix_bug_002",
    issue_id: "bug_002",
    status: "succeeded",
    codex_live: true,
    summary:
      "Moved the JWT signing secret to an environment variable loaded via os.environ; the constant now reads from JWT_SECRET at runtime so the credential never lives in source.",
    changed_files: ["src/autofix_seed/auth.py"],
    diff_preview:
      "--- a/src/autofix_seed/auth.py\n+++ b/src/autofix_seed/auth.py\n@@ -1,7 +1,9 @@\n+import os\n from datetime import datetime, timedelta\n \n def issue_token(user_id):\n-    SECRET = \"super-secret-key-do-not-share\"\n+    SECRET = os.environ[\"JWT_SECRET\"]\n     return jwt.encode(\n         {\"sub\": user_id, \"exp\": datetime.utcnow() + timedelta(hours=1)},\n         SECRET, algorithm=\"HS256\")",
    duration_seconds: 22.1,
    timestamp: "2026-07-18T14:04:23.000Z",
  },
  {
    fix_id: "fix_bug_003",
    issue_id: "bug_003",
    status: "succeeded",
    codex_live: true,
    summary:
      "Removed the - 1 from range(len(items) - 1) so iteration covers every item including the final one.",
    changed_files: ["src/autofix_seed/inventory.py"],
    diff_preview:
      "--- a/src/autofix_seed/inventory.py\n+++ b/src/autofix_seed/inventory.py\n@@ -4,5 +4,5 @@\n def list_stock(items):\n-    for i in range(len(items) - 1):\n+    for i in range(len(items)):\n         yield items[i]",
    duration_seconds: 14.7,
    timestamp: "2026-07-18T14:04:38.000Z",
  },
  {
    fix_id: "fix_bug_004",
    issue_id: "bug_004",
    status: "succeeded",
    codex_live: true,
    summary:
      "Changed the strict > comparison to >= so customers whose order total equals the free-shipping threshold qualify for free shipping.",
    changed_files: ["src/autofix_seed/shipping.py"],
    diff_preview:
      "--- a/src/autofix_seed/shipping.py\n+++ b/src/autofix_seed/shipping.py\n@@ -5,6 +5,6 @@\n def free_shipping(order_total):\n-    if order_total > FREE_SHIPPING_THRESHOLD:\n+    if order_total >= FREE_SHIPPING_THRESHOLD:\n         return 0.0",
    duration_seconds: 16.9,
    timestamp: "2026-07-18T14:04:55.000Z",
  },
  {
    fix_id: "fix_bug_006",
    issue_id: "bug_006",
    status: "succeeded",
    codex_live: true,
    summary:
      "Wrapped the raw file/JSON exceptions in ConfigError so callers handle a single domain error type instead of storage-format-specific exceptions.",
    changed_files: ["src/autofix_seed/config.py"],
    diff_preview:
      "--- a/src/autofix_seed/config.py\n+++ b/src/autofix_seed/config.py\n@@ -9,8 +9,12 @@\n def load(path):\n-    with open(path) as f:\n-        return json.load(f)\n+    try:\n+        with open(path) as f:\n+            return json.load(f)\n+    except (FileNotFoundError, json.JSONDecodeError) as e:\n+        raise ConfigError(f\"Failed to load config from {path}\") from e",
    duration_seconds: 21.3,
    timestamp: "2026-07-18T14:05:16.000Z",
  },
  {
    fix_id: "fix_bug_007",
    issue_id: "bug_007",
    status: "succeeded",
    codex_live: true,
    summary:
      "Extended the refund authorization check to also accept the 'administrator' role, so admins can issue refunds alongside managers.",
    changed_files: ["src/autofix_seed/auth.py"],
    diff_preview:
      "--- a/src/autofix_seed/auth.py\n+++ b/src/autofix_seed/auth.py\n@@ -6,7 +6,7 @@\n def can_issue_refund(user):\n-    return user.get(\"role\") == \"manager\"\n+    role = user.get(\"role\")\n+    return role in (\"manager\", \"administrator\")",
    duration_seconds: 19.6,
    timestamp: "2026-07-18T14:05:36.000Z",
  },
];

// bug_005 is the low-severity unused-variable; below threshold so no fix attempted.

export const mockVerdicts: Verdict[] = [
  {
    verdict_id: "verdict_bug_001",
    fix_id: "fix_bug_001",
    issue_id: "bug_001",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "The fix parameterizes the SQL query with a bind placeholder, eliminating the injection vector. The dedicated test for SQL injection now passes, and all existing payment tests continue to pass — confirming no behavioral regression.",
    confidence: 0.96,
    duration_seconds: 4.2,
    timestamp: "2026-07-18T14:04:05.000Z",
  },
  {
    verdict_id: "verdict_bug_002",
    fix_id: "fix_bug_002",
    issue_id: "bug_002",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "The signing secret is now sourced from the JWT_SECRET environment variable rather than a hardcoded literal. Token issuance still produces valid HS256 tokens when the env var is set, and the credential no longer appears in source.",
    confidence: 0.93,
    duration_seconds: 3.9,
    timestamp: "2026-07-18T14:04:27.000Z",
  },
  {
    verdict_id: "verdict_bug_003",
    fix_id: "fix_bug_003",
    issue_id: "bug_003",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "Removing the off-by-one lets the loop visit every item. The contract test that previously failed on the final-item case now passes.",
    confidence: 0.98,
    duration_seconds: 3.1,
    timestamp: "2026-07-18T14:04:41.000Z",
  },
  {
    verdict_id: "verdict_bug_004",
    fix_id: "fix_bug_004",
    issue_id: "bug_004",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "Switching > to >= makes the threshold inclusive. The free-shipping boundary test — which exercised the exact-threshold case — now passes.",
    confidence: 0.97,
    duration_seconds: 3.4,
    timestamp: "2026-07-18T14:04:58.000Z",
  },
  {
    verdict_id: "verdict_bug_006",
    fix_id: "fix_bug_006",
    issue_id: "bug_006",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "Storage exceptions are now wrapped in ConfigError, matching the documented contract. The error-handling test confirms callers receive ConfigError for both missing and malformed config files.",
    confidence: 0.94,
    duration_seconds: 4.0,
    timestamp: "2026-07-18T14:05:20.000Z",
  },
  {
    verdict_id: "verdict_bug_007",
    fix_id: "fix_bug_007",
    issue_id: "bug_007",
    status: "succeeded",
    tests_passed: true,
    explanation:
      "Administrators are now authorized to issue refunds alongside managers. The previously-failing admin refund test passes, and the manager test continues to pass.",
    confidence: 0.95,
    duration_seconds: 4.3,
    timestamp: "2026-07-18T14:05:40.000Z",
  },
];

export const mockEvalScores: EvalScores = {
  bugs_planted: 7,
  bugs_found: 7,
  detection_rate: 1.0,
  verified_fixes_passed: 6,
  fix_success_rate: 0.857,
  false_positive_count: 0,
  average_recorded_latency_ms: 888,
};

/** A scripted log stream that the dashboard can replay during a mock run. */
export const mockLogScript: Omit<AgentLogEntry, "id" | "ts">[] = [
  { agent: "watcher", level: "info", message: "Semgrep scan started against seeded_repo/" },
  { agent: "watcher", level: "success", message: "Semgrep: 4 findings (2 ERROR, 1 WARNING, 1 INFO)" },
  { agent: "watcher", level: "info", message: "GPT-5.6 gap analysis: 3 semantic issues detected" },
  { agent: "watcher", level: "success", message: "Watcher: 7 issues after dedup (0 false positives)" },
  { agent: "codex", level: "info", message: "Codex sandbox provisioned (network=none, read-only)" },
  { agent: "codex", level: "info", message: "bug_001 → parameterizing SQL query…" },
  { agent: "codex", level: "success", message: "bug_001 fix applied (18.4s, diff 312B)" },
  { agent: "codex", level: "info", message: "bug_002 → moving secret to env var…" },
  { agent: "codex", level: "success", message: "bug_002 fix applied (22.1s, diff 298B)" },
  { agent: "codex", level: "info", message: "bug_003 → fixing off-by-one range…" },
  { agent: "codex", level: "success", message: "bug_003 fix applied (14.7s, diff 96B)" },
  { agent: "codex", level: "info", message: "bug_004 → widening free-shipping threshold…" },
  { agent: "codex", level: "success", message: "bug_004 fix applied (16.9s, diff 124B)" },
  { agent: "codex", level: "info", message: "bug_006 → wrapping storage exceptions…" },
  { agent: "codex", level: "success", message: "bug_006 fix applied (21.3s, diff 256B)" },
  { agent: "codex", level: "info", message: "bug_007 → adding administrator role…" },
  { agent: "codex", level: "success", message: "bug_007 fix applied (19.6s, diff 142B)" },
  { agent: "reviewer", level: "info", message: "Running pytest against patched workspace…" },
  { agent: "reviewer", level: "success", message: "6/6 fixes verified — 0 test regressions" },
  { agent: "reviewer", level: "success", message: "Pipeline complete: 7 found, 6 fixed, 6 verified" },
];
