# Design — AutoFix Swarm

## Seeded Bug Repo & Eval Harness
This is the differentiator — build it before the agents, not as an afterthought.

### Seeded Repo (`seeded_repo/`)
6–8 intentionally planted bugs of known types (reduced from a larger set — enough to be a credible sample without burning a full build day on repo-seeding):
- 2 security issues (e.g. SQL injection via string formatting, hardcoded secret)
- 2 logic bugs (off-by-one, wrong comparison operator)
- 2 code-quality issues (unused variable, missing error handling)
- 1–2 issues Semgrep alone would miss but an LLM reading the code would catch

If Day 1 finishes ahead of schedule, expand toward 10–15 bugs — but the eval harness must work correctly against whatever count you land on; a smaller, verified set beats a larger, half-checked one.

### Ground Truth Schema (`eval/seeded_bugs.json`)
```json
{
  "id": "bug_001",
  "file": "src/payments.py",
  "type": "security",
  "description": "SQL query built via string concatenation, vulnerable to injection",
  "expected_fix_type": "parameterized query"
}
```

### Eval Harness (`eval/run_eval.py`)
Runs the full pipeline against the seeded repo and reports:
- **Detection rate** — bugs found / bugs planted
- **Fix success rate** — fixes that pass tests / bugs found
- **Average agent latency** per issue

This produces a live accuracy number to show during the demo, instead of a cherry-picked run — the thing that separates a real evaluated system from a lucky demo.

Current implementation: validates ground truth and deterministically scores detection rate, fix success, false positives, and recorded latency. Schemas for Watcher, Reviewer, and ground truth live in `eval/schemas/`.

## Agent Output Schemas (Design Contracts)

**Watcher → `issues.json`**
```json
{"id": "...", "file": "...", "line_range": "...", "description": "...", "severity": "...", "confidence": 0.0}
```

**Codex Fixer → `fix_<issue_id>.diff`** + a short structured note (first-draft explanation, refined by Reviewer)

**Reviewer → `verdict_<issue_id>.json`**
```json
{"issue_id": "...", "tests_passed": true, "explanation": "...", "confidence": 0.0}
```

## Dashboard (Frontend) Design
- Single React dashboard.
- **View:** timeline — *Bug found → Codex fix → Verified* — with the explanation shown at each step.
- **v1 is static**, reading from `logs/run_log.db` (last full run), not interactive. Interactivity doesn't add to the "here's the reasoning trace" story judges are scored on; only add it if Day 4 has slack after the fallback recording is done.

## Sandbox Design
- v1 baseline: lightweight isolation — restricted subprocess / firejail / minimal container.
- Guarantees to verify: no network access, no write access outside the scratch copy of the repo.
- Full Docker is an explicit stretch upgrade, not required for v1 — but *some* real isolation is non-negotiable, and should be called out explicitly in the demo and README as a safety design choice (judges reward projects that show they thought about safe autonomous code execution).

## Fallback / Demo Reliability Design
- Cache one full successful pipeline run's output ahead of the deadline (not last-minute).
- Fallback may replay cached evidence during the live demo if APIs fail, but must never be presented as a live GPT-5.6 call.
- Test-play the fallback once, start to finish, before considering Day 4 done.

## Demo Video Design (≤3 minutes)
1. Problem (15s) — one-line pitch
2. Live run (60–90s) — Semgrep vs. GPT-5.6 gap analysis, Codex writing a fix, deterministic test verdict + GPT-5.6 explanation
3. Eval numbers (15s) — live accuracy dashboard, actual planted-bug count and rates
4. Codex + GPT-5.6 collaboration (20s) — division of labor
5. Why this matters (15s) — real teams drowning in issues vs. reviewers
6. Close (10s) — human approval and sandbox boundary

## Logging Design
- SQLite (`logs/run_log.db`) — simplest option given time constraints, no setup overhead.
- Logs every agent action + result.
- Doubles as the data source for both the eval harness and the dashboard timeline view.
