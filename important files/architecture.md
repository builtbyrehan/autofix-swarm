# Architecture — AutoFix Swarm

## Overview
Three agents, each with one clear job. No agent does another agent's job. State passes explicitly between them through an orchestrator — agents never call each other's tools directly.

```
[Seeded Repo]
     │
     ▼
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   WATCHER   │ ───▶ │    CODEX    │ ───▶ │   REVIEWER   │
│ finds bugs  │      │ writes fix  │      │ verifies +   │
│             │      │ (Fixer)     │      │ explains     │
└─────────────┘      └─────────────┘      └──────────────┘
     │                     │                     │
     ▼                     ▼                     ▼
 issue list           local diff          pass/fail +
 (JSON)               (patch file)        explanation (JSON)
                                                │
                                                ▼
                                        [Dashboard UI]
```

## Agent 1 — Watcher (bug detection)
- **Job:** Scan the target repo and produce a ranked list of real issues (not noise).
- **Tools:** Semgrep (static analysis, free/open-source) for known patterns, plus GPT-5.6 via the OpenAI Responses API for issues static analysis misses (unclear logic, naming, authorization, security smells).
- **Model:** `gpt-5.6-luna` by default for cost control; configurable via `OPENAI_MODEL`. Runs only after deterministic Semgrep results are available.
- **Output:** `issues.json` — list of `{id, file, line_range, description, severity, confidence}`.
- **Non-goal:** Watcher never writes fixes — detection and description only.

## Agent 2 — Codex (the Fixer)
- **Job:** Given one issue from `issues.json`, write the actual code fix.
- **Tool:** OpenAI Codex (via Build Week Codex credits). Reads the flagged file/lines, produces a diff, applies the patch locally to a working copy for the demo.
- **Constraint:** Runs inside an isolated environment — no network access, writes confined to a scratch copy of the repo. v1 uses lightweight isolation (restricted subprocess / firejail / minimal container), not full custom Docker.
- **Output:** `fix_<issue_id>.diff` plus a short structured note on what changed and why (Codex's own first-draft explanation, refined by the Reviewer).
- **Non-goal:** GitHub PR opening is out of v1 scope.

## Agent 3 — Reviewer / Explainer
- **Job:** Verify the fix actually works and produce the final human-readable explanation.
- **Tools:** `pytest` (or the seeded repo's test suite) run inside the same sandbox against the patched code; GPT-5.6 turns the diff + deterministic test result into a plain-English explanation without changing the patch.
- **Output:** `verdict_<issue_id>.json` — `{issue_id, tests_passed: bool, explanation: string, confidence: float}`.
- **Non-goal:** Reviewer never re-writes the fix. v1 has no retry loop — a failed test is logged as `tests_passed: false` with an explanation, and the pipeline moves on.

## Tech Stack (exact — no substitutions without updating this file)

| Layer | Choice | Notes |
|---|---|---|
| Fix-writing agent | OpenAI Codex | Only component allowed to write/apply fixes; Codex-credit access must be verified before integration |
| Bug-detection LLM | GPT-5.6 via OpenAI Responses API | `gpt-5.6-luna` default for cost control; used only after Semgrep results are available |
| Explanation LLM | GPT-5.6 via OpenAI Responses API | Explains diff + test evidence; never writes or revises code |
| Static analysis | Semgrep (open-source, CLI) | Run via subprocess from Python backend |
| Orchestration | LangGraph (Python) | Explicit state machine: Watcher → Codex → Reviewer, linear (no retry loop in v1) |
| Backend/API | FastAPI (Python) | Exposes `/scan`, `/fix`, `/verify`, `/results` |
| Sandbox | Lightweight isolation (restricted subprocess / firejail / minimal container) | No network access; writes confined to scratch copy. Full Docker is a stretch upgrade only |
| Code hosting interface | Cut from v1 | Local diff application only |
| Database/logging | SQLite | Logs every agent action + result; doubles as eval data |
| Frontend | React | Single dashboard: timeline view (Bug found → Codex fix → Verified) with explanation at each step |
| Testing/eval | pytest + seeded bug repo | Produces the live accuracy number for the demo |
| Fallback inference | Cached successful run | May replay evidence but must not be presented as a live GPT-5.6 call |

**Cost boundary:** Devpost requires GPT-5.6; Build Week grants are Codex credits, not API credits. Keep GPT-5.6 calls small, metered, and limited to Watcher gap analysis and Reviewer explanation. No additional paid provider. If OpenAI API billing is unavailable, deterministic development may continue, but the project is not submission-ready until a real GPT-5.6 run is captured.

## Repository Structure
```
autofix-swarm/
├── README.md                  # project root doc
├── agents/
│   ├── watcher.py              # Semgrep + GPT-5.6 gap analysis
│   ├── fixer_codex.py          # Codex integration — writes fixes
│   └── reviewer.py             # pytest run + GPT-5.6 explanation generation
├── orchestrator/
│   └── graph.py                 # LangGraph state machine wiring the 3 agents
├── sandbox/
│   └── isolate.py                # lightweight isolation wrapper (restricted subprocess / firejail); Dockerfile optional stretch upgrade
├── seeded_repo/                 # demo target repo with known, intentional bugs
│   ├── src/
│   └── tests/
├── backend/
│   └── main.py                  # FastAPI app: /scan /fix /verify /results
├── frontend/
│   └── src/                     # React dashboard
├── eval/
│   ├── seeded_bugs.json         # ground-truth bug list + expected fixes for scoring
│   └── run_eval.py              # scores the pipeline against seeded_bugs.json
├── logs/
│   └── run_log.db               # SQLite log of every agent action
└── .env.example                 # OPENAI_API_KEY, OPENAI_MODEL; no secret values
```

## Data Contracts
- `issues.json` (Watcher output): `{id, file, line_range, description, severity, confidence}`
- `fix_<issue_id>.diff` + structured note (Codex output)
- `verdict_<issue_id>.json` (Reviewer output): `{issue_id, tests_passed: bool, explanation: string, confidence: float}`
- `eval/seeded_bugs.json` (ground truth): `{id, file, type, description, expected_fix_type}`

Schemas for Watcher, Reviewer, and ground truth are formalized in `eval/schemas/`.
