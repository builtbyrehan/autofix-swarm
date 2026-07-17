# Rules & Constraints — AutoFix Swarm

## Hard Rules (never violate)
- **Codex is the only component allowed to write or apply fixes.** No other model touches code generation.
- **No agent calls another agent's tool directly** — all coordination goes through the orchestrator state machine in `orchestrator/graph.py`.
- **Codex Fixer runs in isolation:** no network access, writes confined to a scratch copy of the repo.
- **Reviewer never re-writes the fix** — it only verifies (pytest) and explains (GPT-5.6).
- **Watcher never writes fixes** — detection and description only.
- **Fallback inference (cached run) must never be presented as a live GPT-5.6 call.**
- **Do not introduce any additional paid provider** beyond Codex credits and GPT-5.6 API usage.
- **Do not claim the Windows-packaged Codex executable is usable until a real call succeeds.**
- Every agent's input/output schema (Section 2/4 of the source README) must be followed exactly so the orchestrator's state passing works without ad-hoc reformatting.
- Build and test each agent in isolation before wiring the full pipeline — never attempt the full orchestrator first.

## Never Cut (regardless of time pressure)
- GPT-5.6 usage
- The eval harness
- Sandboxing of some form (full Docker not required, but *some* real isolation is)

## Explicit Non-Goals (Product Scope)
- No support for languages beyond the seeded repo's language for this submission.
- No production deployment — working prototype against a controlled seeded repo only.
- No multi-repo or multi-language generalization in this version.

## v1 Scope Cuts (deliberate, not silent slips)

| Cut from v1 | Why | Revisit if... |
|---|---|---|
| GitHub PR opening (GitHub API) | Adds an auth + network dependency that doesn't change what the demo proves — local diffs demonstrate the same fix quality | Day 3 checkpoint finishes early with time to spare |
| Retry loop (max 1 retry on test failure) | Adds a state-machine branch and testing burden for a nice-to-have, not core to the pitch | Day 2 checkpoint finishes early |
| Full Docker sandbox | Custom container setup is real engineering time for a safety story that lighter isolation tells just as credibly | Day 1 finishes ahead of schedule, or Docker experience already on hand makes it roughly free |
| 10–15 seeded bugs (kept at 6–8) | Repo-seeding time scales with bug count; 6–8 is enough for a credible eval number without eating a full day | Day 1 finishes early |
| Interactive dashboard (kept static) | Interactivity doesn't add to the "here's the reasoning trace" story judges are scored on | Day 4 has slack after fallback recording is done |

**Principle:** cut the feature, not the credibility. The eval harness and some form of sandbox isolation are what make this a real engineering project rather than a demo trick — those stay no matter what else moves.

## Cut Order If a Day's Checkpoint Is At Risk
1. Frontend polish
2. Full-Docker upgrade (stay on lightweight isolation)
3. Number of planted bugs (down to 4–5 if needed)

*(Never cut: eval harness or some form of sandbox isolation — see "Never Cut" above.)*

## Notes for Codex (Working Agreement)
- Use `gpt-5.6-luna` through the Responses API by default for cost-sensitive Watcher and Reviewer calls; keep the model configurable through `OPENAI_MODEL`.
- Confirm current Codex API/CLI usage against OpenAI's own Codex documentation before integration — interfaces may differ from general assumptions.
- Every agent's input/output schema is defined in the architecture doc — follow exactly.
- Build and test each agent in isolation before wiring the full pipeline.

## Submission Compliance Rules
- Repository must be public with relevant licensing, or private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- README must include setup, sample data, run instructions, Codex collaboration details, key human decisions, and the GPT-5.6 contribution.
- Must provide the `/feedback` Codex Session ID from the thread where most core functionality was built.
- Public YouTube demo must be under 3 minutes with audio covering what was built and how both Codex and GPT-5.6 were used.
- Must include installation instructions, supported platforms, and a judge testing path (since this is a developer tool).
