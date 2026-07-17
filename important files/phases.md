# Phases — AutoFix Swarm Build Plan

4-day build window against the July 21, 2026 5:00 PM PT deadline. Each step should work standalone before moving on. **Do not start the next day's work until the current day's checkpoint passes** — if it doesn't, cut scope per `rules.md` rather than carrying incomplete work forward.

## Current Status (as of July 17, 2026)

**Implemented and locally validated:**
- `seeded_repo/` contains seven intentional Python defects and six behavioral contract tests.
- `eval/seeded_bugs.json` records ground truth without exposing it inside the target source.
- `eval/schemas/` defines the Watcher, Reviewer, and ground-truth JSON contracts.
- `eval/run_eval.py` validates ground truth and deterministically scores detection rate, fix success, false positives, and recorded latency.

**Not yet implemented:** Watcher, Codex Fixer, Reviewer, LangGraph orchestration, sandbox, FastAPI backend, SQLite logging, React dashboard, cached demo replay.

**Local prerequisites / blockers:**
- Python 3.11+ is supported; current dev environment has Python 3.14.3.
- Semgrep and pytest are not installed in the current environment (seeded tests are also compatible with standard-library `unittest`).
- `OPENAI_API_KEY` is not configured — GPT-5.6 access not yet verified.
- The packaged Codex executable is discoverable, but the current shell is denied permission to execute it — Codex runtime integration remains unverified.

**Foundation checks:**
```
python eval/run_eval.py --validate-only
python -m unittest discover -s eval/tests -p "test_*.py"
python -m unittest discover -s seeded_repo/tests -p "test_*.py"
```
The final command is expected to report six failing contracts before remediation — those failures are the evaluation baseline.

---

## Day 1 (today) — De-risk + Foundations
1. **First hour, before anything else:** confirm Codex API/CLI access with one trivial call (read a file, propose a fix), and confirm GPT-5.6 Responses API access with one structured-output call. These are the two highest-uncertainty dependencies in the whole project. Repository and eval fixtures may be built while access is pending, but model integrations must not be presented as verified until a real call succeeds.
2. Create `seeded_repo/` (6–8 planted bugs) + `eval/seeded_bugs.json` ground truth.
3. Build `agents/watcher.py` — get it correctly finding the planted bugs in isolation.

**Checkpoint:** Watcher runs standalone and its output matches expectations against `seeded_bugs.json` for at least half the planted bugs.

## Day 2 — Fix + Verify, Agent by Agent
1. Set up `sandbox/isolate.py` — lightweight isolation wrapper, verified to block network access and writes outside the scratch copy.
2. Build `agents/fixer_codex.py` — Codex reads one issue, produces a diff. Test on one bug first, then run against 2–3 more.
3. Build `agents/reviewer.py` — runs pytest, generates explanation. Test on the fixes from step above.

**Checkpoint:** one bug → fix → verify cycle works manually, agent by agent, without the orchestrator wiring them yet.

## Day 3 — Wire It Together + Measure It
1. Wire all three agents into `orchestrator/graph.py` (LangGraph) — get the full bug → fix → verify loop working end-to-end, linear (no retry loop in v1).
2. Build `backend/main.py` FastAPI endpoints wrapping the orchestrator.
3. Build `eval/run_eval.py` to run the full pipeline against all planted bugs and get real accuracy numbers.

**Checkpoint:** `run_eval.py` produces a detection rate and fix-success rate you'd be comfortable showing live.

## Day 4 — Dashboard, Fallback, Polish, Submit
1. Build `frontend/` dashboard — a static timeline view (not interactive) of the last full run, reading from `logs/run_log.db`.
2. Record fallback: cache one full successful run's output so the demo can replay it if live APIs fail on stage. Do this well before the deadline, not the night before.
3. Polish: README updates, demo script, submission video, Devpost category check.

**Checkpoint:** cached fallback exists and has been test-played once, start to finish, before considering the project done.

---

## Escalation Rule
If a day's checkpoint is at risk, cut in this order (last to cut first): frontend polish → full-Docker upgrade (stay on lightweight isolation) → number of planted bugs (down to 4–5 if needed). Never cut the eval harness or some form of sandbox isolation.
