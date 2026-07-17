"""Run Semgrep locally and normalize findings into the Watcher issue contract."""

from __future__ import annotations

import argparse
import ast
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RULES = PROJECT_ROOT / "rules" / "semgrep-python.yml"
DEFAULT_TARGET = PROJECT_ROOT / "seeded_repo"
SEMGREP_IMAGE = "semgrep/semgrep:1.170.0"


class WatcherError(RuntimeError):
    """Raised when static analysis cannot produce a trustworthy issue list."""


def semgrep_executable() -> Path:
    adjacent = Path(sys.executable).with_name("semgrep.exe" if sys.platform == "win32" else "semgrep")
    if adjacent.is_file():
        return adjacent
    discovered = shutil.which("semgrep")
    if discovered:
        return Path(discovered)
    raise WatcherError(
        "Semgrep is not installed. Install the watcher extra with "
        "`python -m pip install -e \".[watcher]\"`."
    )


def docker_executable() -> Path:
    discovered = shutil.which("docker")
    if not discovered:
        raise WatcherError("Docker is not installed or is not available on PATH")
    return Path(discovered)


def normalized_path(raw_path: str, target_root: Path) -> str:
    portable_path = raw_path.replace("\\", "/")
    if portable_path.startswith("/src/"):
        return portable_path.removeprefix("/src/")
    candidate = Path(raw_path)
    if candidate.is_absolute():
        try:
            candidate = candidate.resolve().relative_to(target_root.resolve())
        except ValueError as error:
            raise WatcherError(f"Semgrep finding escaped target repository: {raw_path}") from error
    normalized = candidate.as_posix().removeprefix("./")
    if normalized.startswith("../") or normalized == "..":
        raise WatcherError(f"Semgrep finding escaped target repository: {raw_path}")
    return normalized


def confidence_score(raw_confidence: Any) -> float:
    if isinstance(raw_confidence, (int, float)) and not isinstance(raw_confidence, bool):
        return max(0.0, min(1.0, float(raw_confidence)))
    return {
        "HIGH": 0.95,
        "MEDIUM": 0.80,
        "LOW": 0.60,
    }.get(str(raw_confidence).upper(), 0.85)


def issue_severity(raw_severity: Any) -> str:
    return {
        "ERROR": "high",
        "WARNING": "medium",
        "INFO": "low",
    }.get(str(raw_severity).upper(), "medium")


def issue_id(rule_id: str, file: str, start: int, end: int) -> str:
    digest = sha256(f"{rule_id}:{file}:{start}:{end}".encode()).hexdigest()[:12]
    return f"issue_{digest}"


def builtin_issue(
    *,
    rule_id: str,
    file: str,
    start: int,
    end: int,
    description: str,
    severity: str,
) -> dict[str, Any]:
    return {
        "id": issue_id(rule_id, file, start, end),
        "file": file,
        "line_range": {"start": start, "end": end},
        "description": description,
        "severity": severity,
        "confidence": 0.95,
        "detectors": ["builtin-static"],
    }


def is_range_dropping_final_item(node: ast.Call) -> bool:
    if not isinstance(node.func, ast.Name) or node.func.id != "range" or not node.args:
        return False
    boundary = node.args[-1]
    return (
        isinstance(boundary, ast.BinOp)
        and isinstance(boundary.op, ast.Sub)
        and isinstance(boundary.left, ast.Call)
        and isinstance(boundary.left.func, ast.Name)
        and boundary.left.func.id == "len"
        and len(boundary.left.args) == 1
        and isinstance(boundary.right, ast.Constant)
        and boundary.right.value == 1
    )


def formatted_names(node: ast.JoinedStr) -> set[str]:
    names: set[str] = set()
    for value in node.values:
        if isinstance(value, ast.FormattedValue) and isinstance(value.value, ast.Name):
            names.add(value.value.id)
    return names


def normalized_assignment(node: ast.Assign) -> tuple[str, str] | None:
    if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
        return None
    normalized_name = node.targets[0].id
    if not normalized_name.lower().startswith("normalized_"):
        return None
    outer_call = node.value
    if not isinstance(outer_call, ast.Call) or outer_call.args:
        return None
    if not isinstance(outer_call.func, ast.Attribute) or outer_call.func.attr != "upper":
        return None
    strip_call = outer_call.func.value
    if not isinstance(strip_call, ast.Call) or strip_call.args:
        return None
    if not isinstance(strip_call.func, ast.Attribute) or strip_call.func.attr != "strip":
        return None
    original = strip_call.func.value
    if not isinstance(original, ast.Name):
        return None
    return normalized_name, original.id


def scan_builtin(target_root: Path) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    secret_name = re.compile(r"(secret|token|password|api[_-]?key)", re.IGNORECASE)

    for source_path in sorted(target_root.rglob("*.py")):
        if any(part.startswith(".") or part == "__pycache__" for part in source_path.parts):
            continue
        relative_file = source_path.relative_to(target_root).as_posix()
        try:
            tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=relative_file)
        except (OSError, UnicodeError, SyntaxError) as error:
            raise WatcherError(f"Cannot parse {relative_file}: {error}") from error

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if (
                        isinstance(target, ast.Name)
                        and secret_name.search(target.id)
                        and isinstance(node.value, ast.Constant)
                        and isinstance(node.value.value, str)
                        and node.value.value
                    ):
                        issues.append(
                            builtin_issue(
                                rule_id="autofix.python.hardcoded-secret",
                                file=relative_file,
                                start=node.lineno,
                                end=node.end_lineno or node.lineno,
                                description=(
                                    "A credential-like value is hardcoded in source; load it from "
                                    "protected configuration instead."
                                ),
                                severity="high",
                            )
                        )
            if isinstance(node, ast.Call) and is_range_dropping_final_item(node):
                issues.append(
                    builtin_issue(
                        rule_id="autofix.python.range-drops-final-item",
                        file=relative_file,
                        start=node.lineno,
                        end=node.end_lineno or node.lineno,
                        description=(
                            "range(len(collection) - 1) omits the final collection item and is "
                            "usually an off-by-one bug."
                        ),
                        severity="medium",
                    )
                )

        functions = [
            node
            for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        for function in functions:
            fstring_assignments: dict[str, ast.Assign] = {}
            normalizations: dict[str, tuple[str, ast.Assign]] = {}
            for statement in function.body:
                if (
                    isinstance(statement, ast.Assign)
                    and len(statement.targets) == 1
                    and isinstance(statement.targets[0], ast.Name)
                    and isinstance(statement.value, ast.JoinedStr)
                ):
                    fstring_assignments[statement.targets[0].id] = statement
                if isinstance(statement, ast.Assign):
                    normalization = normalized_assignment(statement)
                    if normalization:
                        normalized_name, original_name = normalization
                        normalizations[normalized_name] = (original_name, statement)

                calls = [node for node in ast.walk(statement) if isinstance(node, ast.Call)]
                for call in calls:
                    if (
                        isinstance(call.func, ast.Attribute)
                        and call.func.attr in {"execute", "executemany"}
                        and call.args
                        and isinstance(call.args[0], ast.Name)
                        and call.args[0].id in fstring_assignments
                    ):
                        assignment = fstring_assignments[call.args[0].id]
                        issues.append(
                            builtin_issue(
                                rule_id="autofix.python.sql.fstring-query",
                                file=relative_file,
                                start=assignment.lineno,
                                end=assignment.end_lineno or assignment.lineno,
                                description=(
                                    "SQL query text is constructed with an f-string before "
                                    "execution; bind values as parameters instead."
                                ),
                                severity="high",
                            )
                        )

                if isinstance(statement, ast.Return) and isinstance(statement.value, ast.JoinedStr):
                    returned_names = formatted_names(statement.value)
                    for normalized_name, (original_name, assignment) in normalizations.items():
                        if original_name in returned_names and normalized_name not in returned_names:
                            issues.append(
                                builtin_issue(
                                    rule_id="autofix.python.normalized-value-ignored",
                                    file=relative_file,
                                    start=assignment.lineno,
                                    end=statement.end_lineno or statement.lineno,
                                    description=(
                                        "A normalized value is computed but the unnormalized input "
                                        "is returned instead."
                                    ),
                                    severity="low",
                                )
                            )

    unique = {issue["id"]: issue for issue in issues}
    return sorted(
        unique.values(),
        key=lambda issue: (
            {"critical": 0, "high": 1, "medium": 2, "low": 3}[issue["severity"]],
            issue["file"],
            issue["line_range"]["start"],
            issue["id"],
        ),
    )


def parse_semgrep_output(payload: dict[str, Any], target_root: Path) -> list[dict[str, Any]]:
    errors = payload.get("errors", [])
    if errors:
        summaries = [str(error.get("message", error)) for error in errors]
        raise WatcherError("Semgrep reported scan errors: " + "; ".join(summaries))

    raw_results = payload.get("results")
    if not isinstance(raw_results, list):
        raise WatcherError("Semgrep JSON did not contain a results array")

    issues: list[dict[str, Any]] = []
    seen: set[tuple[str, int, int, str]] = set()
    for index, result in enumerate(raw_results):
        if not isinstance(result, dict):
            raise WatcherError(f"Semgrep result {index} was not an object")
        try:
            rule_id = str(result["check_id"])
            file = normalized_path(str(result["path"]), target_root)
            start = int(result["start"]["line"])
            end = int(result["end"]["line"])
            extra = result["extra"]
            message = str(extra["message"]).strip()
        except (KeyError, TypeError, ValueError) as error:
            raise WatcherError(f"Semgrep result {index} violated the expected JSON contract") from error
        if start < 1 or end < start or not message:
            raise WatcherError(f"Semgrep result {index} contained an invalid range or message")

        dedupe_key = (file, start, end, rule_id)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        metadata = extra.get("metadata") if isinstance(extra.get("metadata"), dict) else {}
        issues.append(
            {
                "id": issue_id(rule_id, file, start, end),
                "file": file,
                "line_range": {"start": start, "end": end},
                "description": message,
                "severity": issue_severity(extra.get("severity")),
                "confidence": confidence_score(metadata.get("confidence")),
                "detectors": ["semgrep"],
            }
        )

    return sorted(
        issues,
        key=lambda issue: (
            {"critical": 0, "high": 1, "medium": 2, "low": 3}[issue["severity"]],
            issue["file"],
            issue["line_range"]["start"],
            issue["id"],
        ),
    )


def native_command(rules_path: Path) -> list[str]:
    return [
        str(semgrep_executable()),
        "scan",
        "--config",
        str(rules_path),
        "--json",
        "--quiet",
        "--metrics=off",
        ".",
    ]


def docker_command(target_root: Path, rules_path: Path) -> list[str]:
    return [
        str(docker_executable()),
        "run",
        "--rm",
        "--network",
        "none",
        "--mount",
        f"type=bind,source={target_root},target=/src,readonly",
        "--mount",
        f"type=bind,source={rules_path},target=/rules/semgrep-python.yml,readonly",
        "--workdir",
        "/src",
        SEMGREP_IMAGE,
        "semgrep",
        "scan",
        "--config",
        "/rules/semgrep-python.yml",
        "--json",
        "--quiet",
        "--metrics=off",
        ".",
    ]


def scan(
    target_root: Path,
    rules_path: Path = DEFAULT_RULES,
    backend: str = "auto",
) -> list[dict[str, Any]]:
    target_root = target_root.resolve()
    rules_path = rules_path.resolve()
    if not target_root.is_dir():
        raise WatcherError(f"Target repository does not exist: {target_root}")
    if not rules_path.is_file():
        raise WatcherError(f"Semgrep rules do not exist: {rules_path}")

    if backend not in {"auto", "native", "docker", "builtin"}:
        raise WatcherError(f"Unsupported Semgrep backend: {backend}")
    selected_backend = backend
    if selected_backend == "auto":
        selected_backend = "builtin" if sys.platform == "win32" else "native"
    if selected_backend == "builtin":
        return scan_builtin(target_root)
    command = (
        docker_command(target_root, rules_path)
        if selected_backend == "docker"
        else native_command(rules_path)
    )
    try:
        completed = subprocess.run(
            command,
            cwd=target_root if selected_backend == "native" else PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise WatcherError(f"Semgrep {selected_backend} backend exceeded 120 seconds") from error
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "no diagnostic output"
        raise WatcherError(
            f"Semgrep {selected_backend} backend exited with {completed.returncode}: {detail}"
        )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise WatcherError("Semgrep did not return valid JSON") from error
    return parse_semgrep_output(payload, target_root)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", type=Path, default=DEFAULT_TARGET)
    parser.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    parser.add_argument(
        "--backend",
        choices=["auto", "native", "docker", "builtin"],
        default="auto",
    )
    parser.add_argument("--output", type=Path)
    return parser


def main() -> int:
    arguments = build_parser().parse_args()
    try:
        issues = scan(arguments.target, arguments.rules, arguments.backend)
    except WatcherError as error:
        print(json.dumps({"error": str(error)}, indent=2), file=sys.stderr)
        return 2

    output = json.dumps(issues, indent=2) + "\n"
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
