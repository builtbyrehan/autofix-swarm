# AutoFix Swarm — Autonomous Bug Detection & Remediation Agents

> **Project for:** OpenAI Build Week (Codex Challenge)
> **Devpost track:** Developer Tools
> **Required OpenAI technologies:** Codex + GPT-5.6
> **Runtime roles:** Codex writes and applies fixes; GPT-5.6 detects issues missed by static analysis and produces the final review explanation
> **Deadline:** July 21, 2026, 5:00 PM PT (July 22, 2026, 5:00 AM PKT)
> **Scope status (v3):** Devpost requirements verified July 17, 2026. GitHub PR integration and the retry loop remain outside v1. Lightweight sandboxing is the baseline. **Never cut:** GPT-5.6 usage, the eval harness, or sandboxing of some form.
> **Implementation status:** Day 1 foundation in progress. The seeded repository and deterministic eval foundation are the first build milestone.

### Verified Build Week delivery requirements

- Submit a working project built with Codex and GPT-5.6 in the **Developer Tools** category.
- Provide a public YouTube demo shorter than three minutes. The audio must cover what was built and how both Codex and GPT-5.6 were used.
- Provide a repository that is public with relevant licensing, or private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- Include setup instructions, sample data, run instructions, Codex collaboration details, key human decisions, and the GPT-5.6 contribution in this README.
- Provide the `/feedback` Codex Session ID from the thread where most core functionality was built.
- Because this is a developer tool, include installation instructions, supported platforms, and a way for judges to test it without rebuilding it from scratch.

---

## 1. Problem Statement

Software teams generate bugs and security issues faster than humans can review and fix them. Today the loop is: a human notices an issue → a human decides how to fix it → a human writes the fix → another human reviews it. This is slow and doesn't scale.

**AutoFix Swarm** automates this entire loop using a small team of specialized agents. It finds real issues in a codebase, uses Codex to write the actual fix, verifies the fix against tests, and produces a plain-English explanation of why the fix was made — so a human can trust and merge it quickly instead of redoing the work.

**One-line pitch:** *A system that finds its own bugs, fixes them with Codex, and explains why — so developers don't have to.*

---

## 2. Architecture Overview

Three agents, each with one clear job. No agent does another agent's job. State passes explicitly between them.

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

### Agent 1 — Watcher (bug detection)
- **Job:** Scan the target repo and produce a ranked list of real issues (not noise).
- **Tools:** Semgrep (static analysis, free/open-source) for known patterns + GPT-5.6 through the OpenAI Responses API for issues static analysis misses (unclear logic, naming, authorization, and security smells). The cost-conscious default is `gpt-5.6-luna`; the model is configurable through `OPENAI_MODEL`.
- **Output:** `issues.json` — a list of `{id, file, line_range, description, severity, confidence}`.
- **Explicit non-goal:** Watcher never writes fixes. It only detects and describes.

### Agent 2 — Codex (the Fixer)
- **Job:** Given one issue from `issues.json`, write the actual code fix.
- **Tool:** OpenAI Codex (via Build Week Codex credits). Operates on the repo directly — reads the flagged file/lines, produces a diff, and applies the patch locally to a working copy for the demo. **GitHub PR opening is out of v1 scope** — it's an extra auth/network dependency that doesn't change what the demo proves (see Section 10a).
- **Constraint:** Runs inside an **isolated environment** — no network access, writes confined to a scratch copy of the repo. v1 uses a lightweight isolation mechanism (e.g. a restricted subprocess / `firejail` / minimal container) rather than a full custom Docker setup, to keep build time proportionate to a 4-day window. Upgrade to full Docker only if earlier steps finish ahead of schedule. Isolation is a stated safety design choice either way — mention it explicitly in the demo and README, since judges reward projects that show they thought about safe autonomous code execution.
- **Output:** `fix_<issue_id>.diff` + a short structured note on what changed and why (this note is Codex's own explanation — a first draft, refined by the Reviewer).

### Agent 3 — Reviewer / Explainer
- **Job:** Verify the fix actually works and produce the final human-readable explanation.
- **Tools:** `pytest` (or the seeded repo's test suite) run inside the same sandbox against the patched code; GPT-5.6 turns the diff + deterministic test result into a plain-English explanation without changing the patch.
- **Output:** `verdict_<issue_id>.json` — `{issue_id, tests_passed: bool, explanation: string, confidence: float}`.
- **Explicit non-goal:** Reviewer never re-writes the fix. **v1 has no retry loop** — if tests fail, the issue is logged as `tests_passed: false` with the explanation of what went wrong, and the pipeline moves on. A bounded (max 1) retry is a stretch goal only if core scope finishes early (see Section 10a).

---

## 3. Tech Stack (exact, no substitutions without updating this file)

| Layer | Choice | Notes |
|---|---|---|
| Fix-writing agent | **OpenAI Codex** | Codex is the only component allowed to write or apply fixes. Codex-credit access must be verified before integration |
| Bug-detection LLM | **GPT-5.6 via OpenAI Responses API** | `gpt-5.6-luna` by default for cost control; used only after deterministic Semgrep results are available |
| Explanation LLM | **GPT-5.6 via OpenAI Responses API** | Explains the diff and test evidence; never writes or revises code |
| Static analysis | **Semgrep** (open-source, free, CLI) | Run via subprocess from Python backend |
| Orchestration | **LangGraph** (Python) | Explicit state machine: Watcher → Codex → Reviewer, linear (no retry loop in v1) |
| Backend/API | **FastAPI** (Python) | Exposes `/scan`, `/fix`, `/verify`, `/results` endpoints |
| Sandbox | **Lightweight isolation** (restricted subprocess / `firejail` / minimal container) | No network access, writes confined to a scratch copy of the repo. Full Docker is a stretch upgrade only, not the v1 baseline — see Section 10a |
| Code hosting interface | *(cut from v1 — see Section 10a)* | Local diff application only. Revisit GitHub API integration post-submission if time allows |
| Database/logging | **SQLite** (simplest, no setup overhead given time constraints) | Logs every agent action + result, doubles as eval data |
| Frontend | **React** | Single dashboard: timeline view — Bug found → Codex fix → Verified, with explanation shown at each step |
| Testing/eval | **pytest** + a seeded bug repo (see Section 5) | Produces the live accuracy number for the demo |
| Fallback inference | Cached successful run | The fallback may replay evidence but must not be presented as a live GPT-5.6 call |

**Cost boundary:** Devpost requires GPT-5.6, while Build Week grants are Codex credits rather than API credits. Keep GPT-5.6 calls small, metered, and limited to Watcher gap analysis and Reviewer explanation. Do not introduce any additional paid provider. If OpenAI API billing is unavailable, deterministic development may continue, but the project is not submission-ready until a real GPT-5.6 run is captured.

---

## 4. Repository Structure

```
autofix-swarm/
├── README.md                  # this file
├── agents/
│   ├── watcher.py              # Semgrep + GPT-5.6 gap analysis
│   ├── fixer_codex.py          # Codex integration — writes fixes
│   └── reviewer.py             # pytest run + GPT-5.6 explanation generation
├── orchestrator/
│   └── graph.py                 # LangGraph state machine wiring the 3 agents
├── sandbox/
│   └── isolate.py                # lightweight isolation wrapper (restricted subprocess / firejail); Dockerfile optional stretch upgrade
├── seeded_repo/                 # the demo target repo with known, intentional bugs
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

### Current repository status (July 17, 2026)

Implemented and locally validated:

- `seeded_repo/` contains seven intentional Python defects and six behavioral contract tests.
- `eval/seeded_bugs.json` records ground truth without exposing it inside the target source.
- `eval/schemas/` defines the Watcher, Reviewer, and ground-truth JSON contracts.
- `eval/run_eval.py` validates ground truth and deterministically scores detection rate, fix success, false positives, and recorded latency.

Not yet implemented: Watcher, Codex Fixer, Reviewer, LangGraph orchestration, sandbox, FastAPI backend, SQLite logging, React dashboard, and cached demo replay.

Current local prerequisites and blockers:

- Python 3.11+ is supported; the current development environment has Python 3.14.3.
- Semgrep and pytest are not installed in the current environment. The seeded tests are also compatible with standard-library `unittest`.
- `OPENAI_API_KEY` is not configured, so GPT-5.6 access is not verified.
- The packaged Codex executable is discoverable, but the current shell is denied permission to execute it; Codex runtime integration remains unverified.

Foundation checks:

```powershell
python eval/run_eval.py --validate-only
python -m unittest discover -s eval/tests -p "test_*.py"
python -m unittest discover -s seeded_repo/tests -p "test_*.py"
```

The final command is expected to report six failing contracts before remediation; those failures are the evaluation baseline.

---

## 5. Seeded Bug Repo & Eval Harness (do not skip — this is the differentiator)

Before building the agents, create a small demo repo (`seeded_repo/`) with **6–8 intentionally planted bugs** of known types (reduced from a larger set — enough to be a credible sample without burning a full build day on repo-seeding):
- 2 security issues (e.g. SQL injection via string formatting, hardcoded secret)
- 2 logic bugs (off-by-one, wrong comparison operator)
- 2 code-quality issues (unused variable, missing error handling)
- 1–2 issues Semgrep alone would miss but an LLM reading the code would catch

If Day 1 finishes ahead of schedule, expand toward 10–15 bugs — but the eval harness must work correctly against whatever count you land on; a smaller, verified set beats a larger, half-checked one.

For each planted bug, record in `eval/seeded_bugs.json`:
```json
{
  "id": "bug_001",
  "file": "src/payments.py",
  "type": "security",
  "description": "SQL query built via string concatenation, vulnerable to injection",
  "expected_fix_type": "parameterized query"
}
```

`eval/run_eval.py` runs the full pipeline against this repo and reports:
- Detection rate (bugs found / bugs planted)
- Fix success rate (fixes that pass tests / bugs found)
- Average agent latency per issue

**This produces a live accuracy number you show during the demo instead of one cherry-picked run** — this is what separates a real evaluated system from a lucky demo.

---

## 6. Build Order — Day-by-Day (4 days to deadline)

Each step should work standalone before moving on. Do not start the next day's work until the current day's checkpoint passes — if it doesn't, cut scope per Section 10a rather than carrying incomplete work forward.

### Day 1 (today) — De-risk + foundations
1. **First hour, before anything else:** confirm Codex API/CLI access with one trivial call (read a file, propose a fix), and confirm GPT-5.6 Responses API access with one structured-output call. These are the two highest-uncertainty dependencies in the whole project — resolve them before writing agent logic. Repository and eval fixtures may be built while access is pending, but model integrations must not be presented as verified.
2. Create `seeded_repo/` (6–8 planted bugs) + `eval/seeded_bugs.json` ground truth.
3. Build `agents/watcher.py` — get it correctly finding the planted bugs in isolation.
- **Checkpoint:** Watcher runs standalone and its output matches expectations against `seeded_bugs.json` for at least half the planted bugs.

### Day 2 — Fix + verify, agent by agent
4. Set up `sandbox/isolate.py` — lightweight isolation wrapper, verified to block network access and writes outside the scratch copy.
5. Build `agents/fixer_codex.py` — Codex reads one issue, produces a diff. Test on one bug first, then run against 2–3 more.
6. Build `agents/reviewer.py` — runs `pytest`, generates explanation. Test on the fixes from step 5.
- **Checkpoint:** one bug → fix → verify cycle works manually, agent by agent, without the orchestrator wiring them yet.

### Day 3 — Wire it together + measure it
7. Wire all three into `orchestrator/graph.py` (LangGraph) — get the full bug → fix → verify loop working end-to-end, linear (no retry loop in v1).
8. Build `backend/main.py` FastAPI endpoints wrapping the orchestrator.
9. Build `eval/run_eval.py` — run the full pipeline against all planted bugs, get real accuracy numbers.
- **Checkpoint:** `run_eval.py` produces a detection rate and fix-success rate you'd be comfortable showing live.

### Day 4 — Dashboard, fallback, polish, submit
10. Build `frontend/` dashboard — a static timeline view (not interactive) of the last full run, reading from `logs/run_log.db`.
11. Record fallback: cache one full successful run's output so the demo can replay it if live APIs fail on stage. Do this well before the deadline, not the night before.
12. Polish: README updates, demo script, submission video, Devpost category check.
- **Checkpoint:** cached fallback exists and has been test-played once, start to finish, before you consider yourself done.

**If a day's checkpoint is at risk, cut in this order (last to cut first):** frontend polish → full-Docker upgrade (stay on lightweight isolation) → number of planted bugs (down to 4–5 if needed). **Never cut:** the eval harness or some form of sandbox isolation — these are what make this a credible engineering project rather than a demo trick.

---

## 7. Success Criteria (what "done" means for this project)

- [ ] Pipeline runs end-to-end on the seeded repo without manual intervention
- [ ] Eval harness reports a real detection rate and fix success rate (not hand-picked)
- [ ] Dashboard shows the reasoning trace for at least one full bug lifecycle
- [ ] Codex is the component that writes every fix — no other model touches code generation
- [ ] GPT-5.6 performs the documented Watcher gap analysis and Reviewer explanation in a recorded real run
- [ ] Isolation is real (verified: no network access, no write access outside the scratch repo copy) — full Docker not required for v1, but the isolation guarantee is
- [ ] A cached fallback run exists in case of live API failure during the demo, recorded ahead of the deadline, not last-minute

---

## 8. Demo Script (for the submission video / live demo)

1. **Problem (15s):** State the one-line pitch from Section 1.
2. **Live run (60–90s):** Trigger a scan on the seeded repo, distinguish Semgrep findings from GPT-5.6 gap analysis, show Codex writing a fix, then show the deterministic test verdict and GPT-5.6 explanation.
3. **Eval numbers (15s):** Show the accuracy dashboard from `eval/run_eval.py` — "we tested this against N known bugs [fill in actual planted count], here's our real detection and fix-success rate."
4. **Codex + GPT-5.6 collaboration (20s):** Explain that Codex built and runs the code-fixing step, while GPT-5.6 handles semantic detection and evidence-grounded explanation.
5. **Why this matters (15s):** Tie back to real engineering teams drowning in more issues than reviewers.
6. **Close (10s):** State the human approval and sandbox boundary. Keep the final public YouTube video under three minutes.

---

## 9. Submission Checklist (OpenAI Build Week requirements)

- [ ] Working project and project description (use Section 1 + Section 2 of this README as the base)
- [ ] Public YouTube demo shorter than three minutes, with audio covering the project, Codex, and GPT-5.6
- [ ] Public repository with relevant licensing, or private repository shared with `testing@devpost.com` and `build-week-event@openai.com`
- [x] Correct Devpost category identified: **Developer Tools**
- [ ] README includes setup, sample data, run/test instructions, Codex collaboration, key human decisions, and GPT-5.6 contribution
- [ ] `/feedback` Codex Session ID from the thread where most core functionality was built
- [ ] Installation instructions, supported platforms, and a judge testing path
- [ ] Submitted before **July 21, 2026, 5:00 PM PDT**

---

## 10. Explicit Non-Goals (to prevent scope creep)

- No support for languages beyond the seeded repo's language for this submission.
- No production deployment — this is a working prototype demonstrated against a controlled seeded repo.
- No multi-repo or multi-language generalization in this version.
- No agent should call another agent's tool directly — all coordination goes through the orchestrator state machine in `orchestrator/graph.py`.

---

## 10a. Scope Cuts for v1 (why, and what's deferred)

Made explicit here so they're a decision, not a silent slip, given the ~4-day build window against the July 21 deadline.

| Cut from v1 | Why | Revisit if... |
|---|---|---|
| GitHub PR opening (GitHub API) | Adds an auth + network dependency that doesn't change what the demo proves — local diffs demonstrate the same fix quality | Day 3 checkpoint finishes early with time to spare |
| Retry loop (max 1 retry on test failure) | Adds a state-machine branch and testing burden for a feature that's nice-to-have, not core to the pitch | Day 2 checkpoint finishes early |
| Full Docker sandbox | Custom container setup is real engineering time for a safety story that a lighter isolation mechanism tells just as credibly in a demo | Day 1 finishes ahead of schedule, or Docker experience already on hand makes it roughly free |
| 10–15 seeded bugs (kept at 6–8) | Repo-seeding time scales with bug count; 6–8 is enough for a credible eval number without eating a full day | Day 1 finishes early |
| Interactive dashboard (kept static) | Interactivity doesn't add to the "here's the reasoning trace" story judges are scored on | Day 4 has slack after the fallback recording is done |

**Principle:** cut the feature, not the credibility. Eval harness and *some* form of sandbox isolation are the two things that make this a real engineering project rather than a demo trick — those stay no matter what else moves.

---

## Notes for Codex

- Use `gpt-5.6-luna` through the Responses API by default for cost-sensitive Watcher and Reviewer calls; keep the model configurable through `OPENAI_MODEL`.
- Confirm current Codex API/CLI usage against OpenAI's own Codex documentation before integration — interfaces may differ from general assumptions. Do not claim the current Windows-packaged executable is usable until a real call succeeds.
- Every agent's input/output schema is defined in Section 2 and Section 4 — follow these exactly so the orchestrator's state passing works without ad-hoc reformatting.
- Build and test each agent in isolation (Section 6) before wiring the full pipeline — do not attempt to build the full orchestrator first.
