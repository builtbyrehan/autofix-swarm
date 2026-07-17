# AutoFix Swarm seeded repository

This is a deliberately vulnerable Python fixture used to measure AutoFix Swarm. It is not production software and must never be deployed.

The repository contains seven intentional defects. Their locations and expected remediation classes are held separately in `../eval/seeded_bugs.json` so the target source does not leak ground truth to the Watcher.

The tests define intended behavior. Six tests are expected to fail before remediation; the hardcoded synthetic secret is a static-analysis-only seed. The synthetic value is not a real credential.

Run with pytest after installing the test extra:

```powershell
python -m pytest
```

The same contract suite can be run without third-party packages:

```powershell
python -m unittest discover -s seeded_repo/tests -p "test_*.py"
```
