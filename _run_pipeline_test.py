"""AutoFix Swarm — Full Pipeline Test Script."""
import json
import os
import subprocess
import time
from pathlib import Path

# Load .env manually (python-dotenv may not be installed)
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from agents.watcher import Watcher, WatcherConfig
from agents.fixer_codex import CodexFixer
from agents.reviewer import Reviewer, ReviewerConfig

REPO = "seeded_repo"
ARTIFACTS = Path("artifacts")
ARTIFACTS.mkdir(exist_ok=True)

api_key = os.environ.get("OPENAI_API_KEY", "")
base_url = "https://openrouter.ai/api/v1"
model = "nvidia/nemotron-3-ultra-550b-a55b:free"

print("=" * 50)
print("STAGE 1: WATCHER (Bug Detection)")
print("=" * 50)
t0 = time.time()

watcher_config = WatcherConfig(
    use_semgrep=False,
    use_gpt=True,
    max_issues=50,
    openai_api_key=api_key,
    openai_base_url=base_url,
    openai_model=model,
)
watcher = Watcher(config=watcher_config)
print(f"  API key loaded: {bool(api_key)}")
print(f"  Model: {model}")
print(f"  Base URL: {base_url}")
try:
    watcher_result = watcher.scan(REPO)
except Exception as e:
    print(f"  FATAL WATCHER ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    watcher_result = None
t1 = time.time()

print(f"  Detected: {watcher_result.total_count} issues ({watcher_result.gpt_count} GPT, {watcher_result.semgrep_count} Semgrep)")
print(f"  Duration: {t1 - t0:.1f}s")
for issue in watcher_result.issues:
    lr = issue.line_range
    print(f"    [{issue.severity.upper():8s}] {issue.file}:{lr['start']}-{lr['end']} - {issue.description[:80]}")

issues_data = [i.to_dict() for i in watcher_result.issues]
(ARTIFACTS / "issues.json").write_text(json.dumps(issues_data, indent=2), encoding="utf-8")

print()
print("=" * 50)
print("STAGE 2: CODEX FIXER (Fix Generation)")
print("=" * 50)

fixer = CodexFixer(
    openai_api_key=api_key,
    openai_base_url=base_url,
    openai_model=model,
)
fix_results = []
for issue in watcher_result.issues:
    if issue.confidence < 0.7:
        print(f"  SKIP {issue.id} (confidence {issue.confidence:.0%} < 70%)")
        continue
    print(f"  Fixing {issue.id} ({issue.file}:{issue.line_range['start']})...")
    try:
        result = fixer.fix(
            issue=issue.to_dict(),
            repo_path=REPO,
            artifacts_dir=ARTIFACTS,
        )
        fix_results.append(result)
        icon = "+" if result.status == "succeeded" else "!" if result.status == "blocked" else "x"
        print(f"    [{icon}] {result.status}: {result.summary[:80]}")
        if result.failure_reason:
            print(f"         Reason: {result.failure_reason[:100]}")
    except Exception as e:
        print(f"    [x] ERROR: {e}")

fixes_data = []
for f in fix_results:
    fixes_data.append({
        "issue_id": f.issue_id,
        "status": f.status,
        "codex_live": f.codex_live,
        "summary": f.summary,
        "changed_files": f.changed_files,
        "diff": f.diff[:2000] if f.diff else "",
        "latency_ms": f.duration_seconds * 1000,
    })
(ARTIFACTS / "fixes.json").write_text(json.dumps(fixes_data, indent=2), encoding="utf-8")

print()
print("=" * 50)
print("STAGE 3: REVIEWER (Verification)")
print("=" * 50)

reviewer_config = ReviewerConfig(
    openai_api_key=api_key,
    openai_base_url=base_url,
    openai_model=model,
)
reviewer = Reviewer(config=reviewer_config)
review_results = []

succeeded_fixes = [f for f in fix_results if f.status == "succeeded"]
if not succeeded_fixes:
    print("  No successful fixes to verify (Fixer was blocked or all failed).")
    print("  Running test suite on original repo to establish baseline...")
    try:
        test_result = subprocess.run(
            ["python", "-m", "pytest", "-v", "--tb=short"],
            cwd=REPO,
            capture_output=True,
            text=True,
            timeout=60,
        )
        print(f"  Test exit code: {test_result.returncode}")
        if test_result.stdout:
            for line in test_result.stdout.strip().split("\n")[-15:]:
                print(f"    {line}")
    except Exception as e:
        print(f"  Could not run tests: {e}")

for fix in succeeded_fixes:
    issue_desc = next(
        (i.description for i in watcher_result.issues if i.id == fix.issue_id), ""
    )
    print(f"  Verifying {fix.issue_id}...")
    try:
        result = reviewer.verify(
            issue_id=fix.issue_id,
            repo_path=REPO,
            diff=fix.diff,
            issue_description=issue_desc,
        )
        review_results.append(result)
        icon = "PASS" if result.verdict.tests_passed else "FAIL"
        print(f"    [{icon}] confidence={result.verdict.confidence:.0%}")
        print(f"    {result.verdict.explanation[:120]}")
    except Exception as e:
        print(f"    [ERROR] {e}")

verdicts_data = []
for r in review_results:
    verdicts_data.append({
        "issue_id": r.verdict.issue_id,
        "tests_passed": r.verdict.tests_passed,
        "explanation": r.verdict.explanation,
        "confidence": r.verdict.confidence,
        "latency_ms": r.verdict.latency_ms,
    })
(ARTIFACTS / "verdicts.json").write_text(json.dumps(verdicts_data, indent=2), encoding="utf-8")

print()
print("=" * 50)
print("PIPELINE SUMMARY")
print("=" * 50)
succeeded = sum(1 for f in fix_results if f.status == "succeeded")
blocked = sum(1 for f in fix_results if f.status == "blocked")
failed = sum(1 for f in fix_results if f.status not in ("succeeded", "blocked"))
passed = sum(1 for r in review_results if r.verdict.tests_passed)

print(f"  Issues detected:      {watcher_result.total_count}")
print(f"  Fixes attempted:      {len(fix_results)}")
print(f"  Fixes succeeded:      {succeeded}")
print(f"  Fixes blocked:        {blocked}")
print(f"  Fixes failed:         {failed}")
print(f"  Verifications passed: {passed}")
print(f"  Total duration:       {time.time() - t0:.1f}s")
