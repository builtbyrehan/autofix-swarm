"""Validate seeded ground truth and score Watcher/Reviewer JSON artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
from statistics import fmean
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SEEDED_ROOT = PROJECT_ROOT / "seeded_repo"
DEFAULT_GROUND_TRUTH = Path(__file__).with_name("seeded_bugs.json")


class EvaluationInputError(ValueError):
    """Raised when an evaluation artifact violates the documented contract."""


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise EvaluationInputError(f"File does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise EvaluationInputError(f"Invalid JSON in {path}: {error}") from error


def normalized_repo_path(value: str) -> str:
    normalized = str(PurePosixPath(value.replace("\\", "/"))).lstrip("./")
    if normalized.startswith("seeded_repo/"):
        normalized = normalized.removeprefix("seeded_repo/")
    return normalized


def parse_line_range(record: dict[str, Any], label: str) -> tuple[int, int]:
    line_range = record.get("line_range")
    if not isinstance(line_range, dict):
        raise EvaluationInputError(f"{label}.line_range must be an object")
    start = line_range.get("start")
    end = line_range.get("end")
    if not isinstance(start, int) or isinstance(start, bool) or start < 1:
        raise EvaluationInputError(f"{label}.line_range.start must be a positive integer")
    if not isinstance(end, int) or isinstance(end, bool) or end < start:
        raise EvaluationInputError(f"{label}.line_range.end must be at least start")
    return start, end


def validate_ground_truth(records: Any) -> list[dict[str, Any]]:
    if not isinstance(records, list) or not records:
        raise EvaluationInputError("Ground truth must be a non-empty JSON array")

    required = {
        "id",
        "file",
        "line_range",
        "type",
        "severity",
        "description",
        "expected_detector",
        "expected_fix_type",
        "test_id",
    }
    seen_ids: set[str] = set()

    for index, record in enumerate(records):
        label = f"ground_truth[{index}]"
        if not isinstance(record, dict):
            raise EvaluationInputError(f"{label} must be an object")
        missing = sorted(required - record.keys())
        if missing:
            raise EvaluationInputError(f"{label} is missing: {', '.join(missing)}")

        bug_id = record["id"]
        if not isinstance(bug_id, str) or not bug_id:
            raise EvaluationInputError(f"{label}.id must be a non-empty string")
        if bug_id in seen_ids:
            raise EvaluationInputError(f"Duplicate ground-truth id: {bug_id}")
        seen_ids.add(bug_id)

        source_file = normalized_repo_path(record["file"])
        if source_file.startswith("../") or PurePosixPath(source_file).is_absolute():
            raise EvaluationInputError(f"{label}.file escapes the seeded repository")
        source_path = SEEDED_ROOT / Path(source_file)
        if not source_path.is_file():
            raise EvaluationInputError(f"Ground-truth source does not exist: {source_file}")

        start, end = parse_line_range(record, label)
        source_line_count = len(source_path.read_text(encoding="utf-8").splitlines())
        if end > source_line_count:
            raise EvaluationInputError(
                f"{label}.line_range ends at {end}, but {source_file} has {source_line_count} lines"
            )

        test_id = record["test_id"]
        if test_id is not None:
            if not isinstance(test_id, str) or "::" not in test_id:
                raise EvaluationInputError(f"{label}.test_id must be null or a test node id")
            test_file = test_id.split("::", 1)[0]
            if not (SEEDED_ROOT / test_file).is_file():
                raise EvaluationInputError(f"Ground-truth test does not exist: {test_file}")

    return records


def unwrap_array(value: Any, key: str, label: str) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        value = value.get(key)
    if not isinstance(value, list):
        raise EvaluationInputError(f"{label} must be a JSON array or an object containing '{key}'")
    if not all(isinstance(item, dict) for item in value):
        raise EvaluationInputError(f"Every {label} entry must be an object")
    return value


def ranges_overlap(left: tuple[int, int], right: tuple[int, int]) -> bool:
    return left[0] <= right[1] and right[0] <= left[1]


def match_detections(
    ground_truth: list[dict[str, Any]], issues: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    used_issue_indexes: set[int] = set()

    for truth in ground_truth:
        truth_file = normalized_repo_path(truth["file"])
        truth_range = parse_line_range(truth, truth["id"])
        matched_index: int | None = None

        for issue_index, issue in enumerate(issues):
            if issue_index in used_issue_indexes:
                continue
            if normalized_repo_path(str(issue.get("file", ""))) != truth_file:
                continue
            issue_range = parse_line_range(issue, f"issues[{issue_index}]")
            if ranges_overlap(truth_range, issue_range):
                matched_index = issue_index
                break

        if matched_index is not None:
            used_issue_indexes.add(matched_index)
            matches.append(
                {
                    "ground_truth_id": truth["id"],
                    "issue_id": issues[matched_index].get("id"),
                }
            )

    return matches


def score(
    ground_truth: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    verdicts: list[dict[str, Any]],
) -> dict[str, Any]:
    matches = match_detections(ground_truth, issues)
    detected_issue_ids = {match["issue_id"] for match in matches if match["issue_id"] is not None}
    verdict_by_issue = {
        verdict.get("issue_id"): verdict
        for verdict in verdicts
        if isinstance(verdict.get("issue_id"), str)
    }
    passed = sum(
        verdict_by_issue.get(issue_id, {}).get("tests_passed") is True
        for issue_id in detected_issue_ids
    )
    latencies = [
        float(record["latency_ms"])
        for record in [*issues, *verdicts]
        if isinstance(record.get("latency_ms"), (int, float))
        and not isinstance(record.get("latency_ms"), bool)
        and record["latency_ms"] >= 0
    ]

    planted = len(ground_truth)
    found = len(matches)
    return {
        "bugs_planted": planted,
        "bugs_found": found,
        "detection_rate": found / planted,
        "verified_fixes_passed": passed,
        "fix_success_rate": (passed / found) if found else None,
        "average_recorded_latency_ms": fmean(latencies) if latencies else None,
        "matched_issues": matches,
        "false_positive_count": max(0, len(issues) - found),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ground-truth", type=Path, default=DEFAULT_GROUND_TRUTH)
    parser.add_argument("--issues", type=Path)
    parser.add_argument("--verdicts", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    return parser


def main() -> int:
    arguments = build_parser().parse_args()
    try:
        ground_truth = validate_ground_truth(load_json(arguments.ground_truth))
        if arguments.validate_only:
            result: dict[str, Any] = {
                "ground_truth_valid": True,
                "bug_count": len(ground_truth),
                "seeded_repo": str(SEEDED_ROOT),
            }
        else:
            if arguments.issues is None:
                raise EvaluationInputError("--issues is required unless --validate-only is used")
            issues = unwrap_array(load_json(arguments.issues), "issues", "issues")
            verdicts = (
                unwrap_array(load_json(arguments.verdicts), "verdicts", "verdicts")
                if arguments.verdicts
                else []
            )
            result = score(ground_truth, issues, verdicts)
    except EvaluationInputError as error:
        print(json.dumps({"error": str(error)}, indent=2))
        return 2

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
