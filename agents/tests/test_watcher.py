from pathlib import Path

import pytest

from agents.watcher import WatcherError, parse_semgrep_output, scan_builtin
from eval.run_eval import load_json, match_detections, validate_ground_truth


TARGET_ROOT = Path("seeded_repo").resolve()


def semgrep_result() -> dict:
    return {
        "check_id": "autofix.python.example",
        "path": "src/example.py",
        "start": {"line": 4, "col": 1},
        "end": {"line": 4, "col": 10},
        "extra": {
            "message": "Example finding",
            "severity": "ERROR",
            "metadata": {"confidence": "HIGH"},
        },
    }


def test_parse_semgrep_output_normalizes_the_issue_contract() -> None:
    issues = parse_semgrep_output({"results": [semgrep_result()], "errors": []}, TARGET_ROOT)

    assert issues == [
        {
            "id": issues[0]["id"],
            "file": "src/example.py",
            "line_range": {"start": 4, "end": 4},
            "description": "Example finding",
            "severity": "high",
            "confidence": 0.95,
            "detectors": ["semgrep"],
        }
    ]
    assert issues[0]["id"].startswith("issue_")


def test_parse_semgrep_output_deduplicates_identical_findings() -> None:
    finding = semgrep_result()

    issues = parse_semgrep_output({"results": [finding, finding], "errors": []}, TARGET_ROOT)

    assert len(issues) == 1


def test_parse_semgrep_output_rejects_scan_errors() -> None:
    with pytest.raises(WatcherError, match="scan errors"):
        parse_semgrep_output(
            {"results": [], "errors": [{"message": "invalid rule"}]},
            TARGET_ROOT,
        )


def test_builtin_scanner_meets_the_day_one_detection_checkpoint() -> None:
    issues = scan_builtin(TARGET_ROOT)
    ground_truth = validate_ground_truth(load_json(Path("eval/seeded_bugs.json")))

    matches = match_detections(ground_truth, issues)

    assert len(issues) == 4
    assert len(matches) == 4
    assert {issue["detectors"][0] for issue in issues} == {"builtin-static"}
