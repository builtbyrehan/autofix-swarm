# Evaluation harness

`seeded_bugs.json` is the private-to-the-evaluator ground truth for the intentionally buggy target. The Watcher must never receive this file as model or static-analysis input.

Validate the fixture without running the target application or its tests:

```powershell
python eval/run_eval.py --validate-only
```

Score Watcher output and optional Reviewer verdicts:

```powershell
python eval/run_eval.py --issues artifacts/issues.json --verdicts artifacts/verdicts.json
```

Detection uses deterministic file equality and line-range overlap. Each detected issue may match at most one planted bug. Fix success is the fraction of matched detected issues whose Reviewer verdict has `tests_passed: true`; it is `null` when nothing is detected. Recorded latency is averaged only from artifacts that explicitly contain non-negative `latency_ms` values.

The harness does not call a model, modify the seeded repository, run tests, or apply fixes. Later orchestration will produce its inputs.
