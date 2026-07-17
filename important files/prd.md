# PRD — AutoFix Swarm

## Event Context
- **Project:** AutoFix Swarm — Autonomous Bug Detection & Remediation Agents
- **Event:** OpenAI Build Week (Codex Challenge)
- **Devpost track:** Developer Tools
- **Required OpenAI technologies:** Codex + GPT-5.6
- **Deadline:** July 21, 2026, 5:00 PM PT (July 22, 2026, 5:00 AM PKT)
- **Scope status:** v3 — Devpost requirements verified July 17, 2026

## One-Line Pitch
A system that finds its own bugs, fixes them with Codex, and explains why — so developers don't have to.

## Problem Statement
Software teams generate bugs and security issues faster than humans can review and fix them. Today's loop — human notices → human decides fix → human writes fix → human reviews — is slow and doesn't scale.

AutoFix Swarm automates this loop with a small team of specialized agents: it finds real issues in a codebase, uses Codex to write the actual fix, verifies the fix against tests, and produces a plain-English explanation so a human can trust and merge quickly.

## Target Users
Judges evaluating a Developer Tools submission, and — as the underlying use case — software teams that need a trustworthy, explainable way to triage and fix routine bugs without a human doing every step.

## Verified Build Week Delivery Requirements
- Submit a working project built with Codex and GPT-5.6, in the Developer Tools category.
- Public YouTube demo, under 3 minutes, with audio covering what was built and how both Codex and GPT-5.6 were used.
- Repository: public with relevant licensing, OR private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- README must include: setup instructions, sample data, run instructions, Codex collaboration details, key human decisions, and the GPT-5.6 contribution.
- Provide the `/feedback` Codex Session ID from the thread where most core functionality was built.
- Since this is a developer tool: include installation instructions, supported platforms, and a way for judges to test it without rebuilding from scratch.
- Submitted before July 21, 2026, 5:00 PM PDT.

## Success Criteria (Definition of Done)
- [ ] Pipeline runs end-to-end on the seeded repo without manual intervention
- [ ] Eval harness reports a real detection rate and fix success rate (not hand-picked)
- [ ] Dashboard shows the reasoning trace for at least one full bug lifecycle
- [ ] Codex is the component that writes every fix — no other model touches code generation
- [ ] GPT-5.6 performs the documented Watcher gap analysis and Reviewer explanation in a recorded real run
- [ ] Isolation is real and verified (no network access, no write access outside the scratch repo copy) — full Docker not required for v1, but the isolation guarantee is
- [ ] A cached fallback run exists in case of live API failure during the demo, recorded ahead of the deadline

## Demo Script (target: video source of truth)
1. **Problem (15s):** State the one-line pitch.
2. **Live run (60–90s):** Trigger a scan on the seeded repo; distinguish Semgrep findings from GPT-5.6 gap analysis; show Codex writing a fix; show the deterministic test verdict and GPT-5.6 explanation.
3. **Eval numbers (15s):** Show the accuracy dashboard from `eval/run_eval.py` — actual detection and fix-success rate against N known planted bugs.
4. **Codex + GPT-5.6 collaboration (20s):** Codex builds/runs the code-fixing step; GPT-5.6 handles semantic detection and evidence-grounded explanation.
5. **Why this matters (15s):** Tie back to real engineering teams drowning in more issues than reviewers.
6. **Close (10s):** State the human approval and sandbox boundary.

## Submission Checklist
- [ ] Working project + project description (based on Problem Statement + Architecture Overview)
- [ ] Public YouTube demo (<3 min) with audio covering project, Codex, and GPT-5.6
- [ ] Public repo with license, or private repo shared with `testing@devpost.com` and `build-week-event@openai.com`
- [ ] Correct Devpost category: Developer Tools
- [ ] README includes setup, sample data, run/test instructions, Codex collaboration, key human decisions, GPT-5.6 contribution
- [ ] `/feedback` Codex Session ID from the core-functionality thread
- [ ] Installation instructions, supported platforms, judge testing path
- [ ] Submitted before July 21, 2026, 5:00 PM PDT

## Explicit Non-Goals (Product Level)
- No support for languages beyond the seeded repo's language for this submission.
- No production deployment — this is a working prototype against a controlled seeded repo.
- No multi-repo or multi-language generalization in this version.

See `rules.md` for the full non-goals and scope-cut list, and `phases.md` for the current implementation status.
