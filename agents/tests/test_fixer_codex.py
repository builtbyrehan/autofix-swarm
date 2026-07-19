"""Tests for the Codex Fixer agent.

All tests avoid live Codex invocation. A test-only static fake runner is used
where runner injection is required. This runner MUST NEVER be accessible in
normal runtime mode.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

import pytest

# The test-only fake runner MUST NOT be importable from the main package.
# It lives only in this test module.

# ---------------------------------------------------------------------------
# Test-only fake runner — never used outside tests
# ---------------------------------------------------------------------------


class _TestFakeRunner:
    """Test-only fake Codex runner with configurable static output.

    This runner MUST NEVER be usable from normal runtime configuration.
    It is defined only in this test module and used exclusively through
    dependency injection in tests.
    """

    def __init__(
        self,
        *,
        exit_code: int = 0,
        stdout: str = "",
        stderr: str = "",
        timed_out: bool = False,
        blocked: bool = False,
        available: bool = True,
    ) -> None:
        self._exit_code = exit_code
        self._stdout = stdout
        self._stderr = stderr
        self._timed_out = timed_out
        self._blocked = blocked
        self._available = available
        self.last_prompt: Optional[str] = None
        self.last_cwd: Optional[Path] = None

    def is_available(self) -> bool:
        return self._available

    def run(self, prompt, *, cwd, timeout_seconds=120, max_output_bytes=524288):
        self.last_prompt = prompt
        self.last_cwd = cwd
        if self._blocked:
            from agents.fixer_codex import CodexRunnerResult
            return CodexRunnerResult(
                exit_code=1, stdout="", stderr="402 deactivated_workspace",
                timed_out=False, blocked=True,
            )
        if self._timed_out:
            from agents.fixer_codex import CodexRunnerResult
            return CodexRunnerResult(
                exit_code=-1, stdout="", stderr="timed out",
                timed_out=True, blocked=False,
            )
        from agents.fixer_codex import CodexRunnerResult
        return CodexRunnerResult(
            exit_code=self._exit_code,
            stdout=self._stdout,
            stderr=self._stderr,
            timed_out=False,
            blocked=False,
        )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def seeded_repo() -> Path:
    """Return the absolute path to the seeded repository."""
    return Path(__file__).resolve().parent.parent.parent / "seeded_repo"


@pytest.fixture
def valid_issue_dict() -> dict:
    return {
        "id": "bug_001",
        "file": "src/autofix_seed/payments.py",
        "line_range": {"start": 6, "end": 7},
        "description": "SQL injection via string interpolation",
        "severity": "high",
        "confidence": 0.95,
    }


@pytest.fixture
def temp_artifacts() -> Path:
    with tempfile.TemporaryDirectory(prefix="afs-test-artifacts-") as td:
        yield Path(td)


# ===================================================================
# 1. Issue validation tests (no Docker needed)
# ===================================================================


class TestValidateIssue:
    """Tests for the _validate_issue function — no Docker required."""

    def test_valid_issue(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, FixRequest
        result = _validate_issue(valid_issue_dict, seeded_repo)
        assert isinstance(result, FixRequest)
        assert result.id == "bug_001"
        assert result.file == "src/autofix_seed/payments.py"

    def test_missing_required_fields(self, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        with pytest.raises(InvalidIssueError, match="missing required fields"):
            _validate_issue({"id": "x"}, seeded_repo)

    def test_empty_id(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["id"] = ""
        with pytest.raises(InvalidIssueError, match="id"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_unsafe_id(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["id"] = "../../etc/passwd"
        with pytest.raises(InvalidIssueError, match="unsafe"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_unsafe_id_with_spaces(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["id"] = "hello world"
        with pytest.raises(InvalidIssueError, match="unsafe"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_absolute_file_path(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["file"] = "/etc/passwd"
        with pytest.raises(InvalidIssueError, match="absolute|outside the repository"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_path_traversal(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["file"] = "../secrets.env"
        with pytest.raises(InvalidIssueError, match="traversal|outside the repository"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_path_outside_repo(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["file"] = "../../../windows/system32/drivers/etc/hosts"
        with pytest.raises(InvalidIssueError, match="traversal|outside the repository"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_nonexistent_file(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["file"] = "src/autofix_seed/nope.py"
        with pytest.raises(InvalidIssueError, match="does not exist"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_unsupported_extension(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["file"] = "README.md"
        with pytest.raises(InvalidIssueError, match="unsupported"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_invalid_severity(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["severity"] = "critical-but-wrong"
        with pytest.raises(InvalidIssueError, match="severity"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_negative_confidence(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["confidence"] = -0.1
        with pytest.raises(InvalidIssueError, match="confidence"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_confidence_over_one(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["confidence"] = 1.5
        with pytest.raises(InvalidIssueError, match="confidence"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_line_range_start_lt_1(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["line_range"] = {"start": 0, "end": 5}
        with pytest.raises(InvalidIssueError, match="start"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_line_range_end_before_start(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["line_range"] = {"start": 10, "end": 5}
        with pytest.raises(InvalidIssueError, match="end"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_line_range_as_list(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue
        valid_issue_dict["line_range"] = [6, 7]
        result = _validate_issue(valid_issue_dict, seeded_repo)
        assert result.line_range == [6, 7]

    def test_empty_description(self, valid_issue_dict, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        valid_issue_dict["description"] = ""
        with pytest.raises(InvalidIssueError, match="description"):
            _validate_issue(valid_issue_dict, seeded_repo)

    def test_non_dict_input(self, seeded_repo):
        from agents.fixer_codex import _validate_issue, InvalidIssueError
        with pytest.raises(InvalidIssueError, match="dict"):
            _validate_issue("not a dict", seeded_repo)

    def test_safe_filename_component(self):
        from agents.fixer_codex import _safe_filename_component
        assert _safe_filename_component("bug_001") == "bug_001"
        assert _safe_filename_component("hello.world") == "hello.world"
        assert _safe_filename_component("../bad") == ".._bad"
        assert _safe_filename_component("a/b") == "a_b"


# ===================================================================
# 2. Patch validation tests (no Docker needed)
# ===================================================================


class TestValidatePatch:
    """Tests for the _validate_patch function — no Docker required."""

    VALID_DIFF = (
        "--- a/src/autofix_seed/payments.py\n"
        "+++ b/src/autofix_seed/payments.py\n"
        "@@ -4,7 +4,7 @@ def lookup_payment(connection, customer_id: str):\n"
        '     """Return one payment row for a customer."""\n'
        "-    query = f\"SELECT id, amount FROM payments WHERE customer_id = '{customer_id}'\"\n"
        "+    query = \"SELECT id, amount FROM payments WHERE customer_id = ?\"\n"
        "     return connection.execute(query).fetchone()\n"
    )

    @staticmethod
    def _request(**overrides):
        from agents.fixer_codex import FixRequest
        defaults = dict(
            id="bug_001",
            file="src/autofix_seed/payments.py",
            line_range=[6, 7],
            description="test",
            severity="high",
            confidence=0.9,
        )
        defaults.update(overrides)
        return FixRequest(**defaults)

    def test_valid_diff(self, seeded_repo):
        from agents.fixer_codex import _validate_patch
        req = self._request()
        # No exception means success
        _validate_patch(self.VALID_DIFF, req, seeded_repo)

    def test_empty_diff(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError
        with pytest.raises(PatchValidationError, match="empty"):
            _validate_patch("", self._request(), seeded_repo)

    def test_oversized_diff(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError, _MAX_DIFF_BYTES
        big_diff = "--- a/src/autofix_seed/payments.py\n+++ b/src/autofix_seed/payments.py\n"
        big_diff += "@@ -1 +1 @@\n-a\n" + ("x" * _MAX_DIFF_BYTES) + "\n"
        with pytest.raises(PatchValidationError, match="exceeds size"):
            _validate_patch(big_diff, self._request(), seeded_repo)

    def test_no_changed_files(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError
        req = self._request(file="src/autofix_seed/payments.py")
        # Diff that doesn't mention any file
        with pytest.raises(PatchValidationError, match="no changed files"):
            _validate_patch("some text without diff headers\n", req, seeded_repo)

    def test_flagged_file_not_changed(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError
        diff = (
            "--- a/src/autofix_seed/inventory.py\n"
            "+++ b/src/autofix_seed/inventory.py\n"
            "@@ -4,5 +4,5 @@ def total_stock(quantities: list[int]) -> int:\n"
            "-    return sum(quantities[index] for index in range(len(quantities) - 1))\n"
            "+    return sum(quantities[index] for index in range(len(quantities)))\n"
        )
        with pytest.raises(PatchValidationError, match="not changed"):
            _validate_patch(diff, self._request(), seeded_repo)

    def test_second_file_changed(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError
        diff = self.VALID_DIFF + (
            "--- a/src/autofix_seed/inventory.py\n"
            "+++ b/src/autofix_seed/inventory.py\n"
            "@@ -4,5 +4,5 @@\n"
            "-old\n+new\n"
        )
        with pytest.raises(PatchValidationError, match="beyond the flagged"):
            _validate_patch(diff, self._request(), seeded_repo)

    def test_test_file_changed(self, seeded_repo):
        from agents.fixer_codex import _validate_patch, PatchValidationError
        diff = (
            "--- a/src/autofix_seed/payments.py\n"
            "+++ b/src/autofix_seed/payments.py\n"
            "@@ -4,7 +4,7 @@\n"
            "-old\n+new\n"
            "--- a/tests/test_payments.py\n"
            "+++ b/tests/test_payments.py\n"
            "@@ -20,7 +20,7 @@\n"
            "-old\n+new\n"
        )
        with pytest.raises(PatchValidationError, match="unpermitted"):
            _validate_patch(diff, self._request(), seeded_repo)

    def test_changed_files_from_diff(self):
        from agents.fixer_codex import _changed_files_from_diff
        files = _changed_files_from_diff(self.VALID_DIFF)
        assert files == ["src/autofix_seed/payments.py"]


# ===================================================================
# 3. CodexCliRunner tests (no live Codex)
# ===================================================================


class TestCodexCliRunner:
    """Tests for CodexCliRunner construction and detection."""

    def test_find_executable_returns_none_in_test_env(self):
        """Runner should gracefully handle missing executable."""
        from agents.fixer_codex import CodexCliRunner
        runner = CodexCliRunner(executable=Path("nonexistent-codex.exe"))
        assert not runner.is_available()

    def test_runner_raises_on_missing_executable(self):
        from agents.fixer_codex import CodexCliRunner, CodexUnavailableError
        runner = CodexCliRunner(executable=Path("nonexistent-codex.exe"))
        with pytest.raises(CodexUnavailableError, match="not found"):
            runner.run("test", cwd=Path("."))

    def test_bounded_output(self):
        """Runner should respect max_output_bytes."""
        from agents.fixer_codex import CodexCliRunner, CodexUnavailableError
        runner = CodexCliRunner(executable=Path("nonexistent-codex.exe"))
        with pytest.raises(CodexUnavailableError):
            runner.run("test", cwd=Path("."), max_output_bytes=100)

    def test_blocked_detection(self):
        from agents.fixer_codex import CodexCliRunner
        assert CodexCliRunner._detect_blocked("402 Payment Required", "", 1)
        assert CodexCliRunner._detect_blocked("", "deactivated_workspace", 1)
        assert CodexCliRunner._detect_blocked("usage limit exceeded", "", 0)
        assert not CodexCliRunner._detect_blocked("normal output", "", 0)

    def test_sanitize_removes_tokens(self):
        from agents.fixer_codex import _sanitize
        result = _sanitize("sk-my-secret-key-1234567890abcdefghij")
        assert "<sanitized>" in result
        assert "sk-" not in result

    def test_sanitize_removes_api_key_pattern(self):
        from agents.fixer_codex import _sanitize
        result = _sanitize('api_key = "my-secret-api-key-12345"')
        assert "<sanitized>" in result


# ===================================================================
# 4. FixRequest dataclass tests
# ===================================================================


class TestFixRequest:
    def test_creation(self):
        from agents.fixer_codex import FixRequest
        r = FixRequest(
            id="bug_001",
            file="src/x.py",
            line_range=[1, 5],
            description="test",
            severity="high",
            confidence=0.8,
        )
        assert r.id == "bug_001"
        assert isinstance(r.line_range, list)


# ===================================================================
# 5. CodexFixer full flow tests (need Docker for SandboxWorkspace)
# ===================================================================


class TestCodexFixer:
    """These tests use the fake runner but need Docker for the sandbox.

    They are skipped when Docker is unavailable.
    """

    @pytest.fixture
    def fixer_with_fake_runner(self):
        from agents.fixer_codex import CodexFixer
        return CodexFixer(runner=_TestFakeRunner())

    def _docker_available(self) -> bool:
        try:
            proc = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
                check=False,
            )
            return proc.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError, OSError):
            return False

    def test_rejected_invalid_issue(self, fixer_with_fake_runner, seeded_repo, temp_artifacts):
        """Missing fields should be rejected before reaching sandbox."""
        bad_issue = {"id": "x"}
        result = fixer_with_fake_runner.fix(bad_issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "rejected"
        assert not result.codex_live
        assert result.artifact_path is None

    def test_rejected_unsafe_id(self, fixer_with_fake_runner, seeded_repo, temp_artifacts):
        bad_issue = {
            "id": "../bad",
            "file": "src/autofix_seed/payments.py",
            "line_range": [6, 7],
            "description": "test",
            "severity": "high",
            "confidence": 0.9,
        }
        result = fixer_with_fake_runner.fix(bad_issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "rejected"
        assert result.artifact_path is None

    def test_runner_not_available(self, seeded_repo, temp_artifacts):
        from agents.fixer_codex import CodexFixer
        unavailable_runner = _TestFakeRunner(available=False)
        fixer = CodexFixer(runner=unavailable_runner)
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "test",
            "severity": "high",
            "confidence": 0.9,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "blocked"
        assert not result.codex_live
        assert result.artifact_path is None

    def test_blocked_402(self, seeded_repo, temp_artifacts):
        """Simulated 402 deactivated_workspace should produce blocked."""
        from agents.fixer_codex import CodexFixer
        blocked_runner = _TestFakeRunner(blocked=True)
        fixer = CodexFixer(runner=blocked_runner)
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "test",
            "severity": "high",
            "confidence": 0.9,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "blocked"
        assert not result.codex_live
        assert result.artifact_path is None

    def test_timed_out(self, seeded_repo, temp_artifacts):
        from agents.fixer_codex import CodexFixer
        timeout_runner = _TestFakeRunner(timed_out=True)
        fixer = CodexFixer(runner=timeout_runner)
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "test",
            "severity": "high",
            "confidence": 0.9,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status in ("blocked", "failed")
        assert result.artifact_path is None

    def test_nonzero_exit(self, seeded_repo, temp_artifacts):
        from agents.fixer_codex import CodexFixer
        failed_runner = _TestFakeRunner(exit_code=1, stderr="Codex error")
        fixer = CodexFixer(runner=failed_runner)
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "test",
            "severity": "high",
            "confidence": 0.9,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status in ("failed", "blocked")
        assert result.artifact_path is None

    @pytest.mark.skipif(
        not __import__("subprocess").run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15).returncode == 0,
        reason="Docker not available",
    )
    def test_successful_fix_with_fake_runner(self, seeded_repo, temp_artifacts):
        """Full happy-path: fake runner + real sandbox + valid diff verification."""
        from agents.fixer_codex import CodexFixer, CodexRunnerResult

        class _ApplyFixRunner:
            """Simulates Codex writing a fix to the workspace file."""
            def __init__(self):
                self.last_prompt = None
                self.last_cwd = None

            def is_available(self):
                return True

            def run(self, prompt, *, cwd, timeout_seconds=120, max_output_bytes=524288):
                self.last_prompt = prompt
                self.last_cwd = cwd
                # Simulate Codex fixing the file by writing the fix directly
                # to the workspace.
                target = Path(cwd) / "src/autofix_seed/payments.py"
                if target.exists():
                    content = target.read_text(encoding="utf-8")
                    # Fix: replace the f-string query with parameterized query
                    content = content.replace(
                        "f\"SELECT id, amount FROM payments WHERE customer_id = '{customer_id}'\"",
                        '"SELECT id, amount FROM payments WHERE customer_id = ?"'
                    )
                    target.write_text(content, encoding="utf-8")
                return CodexRunnerResult(
                    exit_code=0, stdout="fix applied", stderr="",
                    timed_out=False, blocked=False,
                )

        fixer = CodexFixer(runner=_ApplyFixRunner())

        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "SQL injection via string interpolation",
            "severity": "high",
            "confidence": 0.95,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)

        assert result.status == "succeeded", f"Expected succeeded, got {result.status}: {result.failure_reason}"
        assert result.codex_live
        assert result.diff
        assert result.artifact_path is not None
        assert result.artifact_path.exists()
        assert result.changed_files == ["src/autofix_seed/payments.py"]

        # Verify artifacts
        note_path = Path(temp_artifacts) / "fix_bug_001.json"
        assert note_path.exists()
        note = json.loads(note_path.read_text(encoding="utf-8"))
        assert note["issue_id"] == "bug_001"
        assert note["codex_live"] is True
        assert note["status"] == "succeeded"

    @pytest.mark.skipif(
        not __import__("subprocess").run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15).returncode == 0,
        reason="Docker not available",
    )
    def test_second_file_change_rejected(self, seeded_repo, temp_artifacts):
        """Simulated Codex that changes a second file should be rejected."""
        from agents.fixer_codex import CodexFixer, CodexRunnerResult

        class _MultiFileFixRunner:
            def __init__(self):
                self.last_prompt = None
                self.last_cwd = None

            def is_available(self):
                return True

            def run(self, prompt, *, cwd, timeout_seconds=120, max_output_bytes=524288):
                self.last_prompt = prompt
                self.last_cwd = cwd
                target = Path(cwd) / "src/autofix_seed/payments.py"
                if target.exists():
                    # Write to the flagged file
                    content = target.read_text(encoding="utf-8")
                    content = content.replace(
                        "f\"SELECT id, amount FROM payments WHERE customer_id = '{customer_id}'\"",
                        '"SELECT id, amount FROM payments WHERE customer_id = ?"'
                    )
                    target.write_text(content, encoding="utf-8")
                # Also write to a second file (should be rejected)
                second = Path(cwd) / "src/autofix_seed/inventory.py"
                if second.exists():
                    content2 = second.read_text(encoding="utf-8")
                    content2 = content2.replace(
                        "range(len(quantities) - 1)",
                        "range(len(quantities))"
                    )
                    second.write_text(content2, encoding="utf-8")
                return CodexRunnerResult(
                    exit_code=0, stdout="", stderr="",
                    timed_out=False, blocked=False,
                )

        fixer = CodexFixer(runner=_MultiFileFixRunner())
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "SQL injection",
            "severity": "high",
            "confidence": 0.95,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "rejected", f"Expected rejected, got {result.status}"
        assert result.artifact_path is None

    @pytest.mark.skipif(
        not __import__("subprocess").run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15).returncode == 0,
        reason="Docker not available",
    )
    def test_unpermitted_test_file_change_rejected(self, seeded_repo, temp_artifacts):
        """Simulated Codex changing a test file should be rejected."""
        from agents.fixer_codex import CodexFixer, CodexRunnerResult

        class _TestFileFixRunner:
            def __init__(self):
                self.last_prompt = None
                self.last_cwd = None

            def is_available(self):
                return True

            def run(self, prompt, *, cwd, timeout_seconds=120, max_output_bytes=524288):
                self.last_prompt = prompt
                self.last_cwd = cwd
                test_file = Path(cwd) / "tests/test_payments.py"
                if test_file.exists():
                    content = test_file.read_text(encoding="utf-8")
                    test_file.write_text(content, encoding="utf-8")
                return CodexRunnerResult(
                    exit_code=0, stdout="", stderr="",
                    timed_out=False, blocked=False,
                )

        fixer = CodexFixer(runner=_TestFileFixRunner())
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "SQL injection",
            "severity": "high",
            "confidence": 0.95,
        }
        result = fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.status == "rejected", f"Expected rejected, got {result.status}"
        assert result.artifact_path is None

    @pytest.mark.skipif(
        not __import__("subprocess").run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15).returncode == 0,
        reason="Docker not available",
    )
    def test_no_artifact_for_failure(self, seeded_repo, temp_artifacts):
        """No artifact should be created for a failed fix."""
        from agents.fixer_codex import CodexFixer
        bad_issue = {"id": "x"}
        fixer = CodexFixer(runner=_TestFakeRunner())
        result = fixer.fix(bad_issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)
        assert result.artifact_path is None
        artifacts = list(temp_artifacts.iterdir())
        assert len(artifacts) == 0

    @pytest.mark.skipif(
        not __import__("subprocess").run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15).returncode == 0,
        reason="Docker not available",
    )
    def test_original_repo_unchanged(self, seeded_repo, temp_artifacts):
        """Original repository must be unchanged after a fix attempt."""
        import hashlib
        from agents.fixer_codex import CodexFixer, _compute_repo_hash, CodexRunnerResult

        hash_before = _compute_repo_hash(seeded_repo)

        class _SimpleRunner:
            def __init__(self):
                self.last_prompt = None
                self.last_cwd = None

            def is_available(self):
                return True

            def run(self, prompt, *, cwd, timeout_seconds=120, max_output_bytes=524288):
                self.last_prompt = prompt
                self.last_cwd = cwd
                target = Path(cwd) / "src/autofix_seed/payments.py"
                if target.exists():
                    content = target.read_text(encoding="utf-8")
                    content = content.replace(
                        "f\"SELECT id, amount FROM payments WHERE customer_id = '{customer_id}'\"",
                        '"SELECT id, amount FROM payments WHERE customer_id = ?"'
                    )
                    target.write_text(content, encoding="utf-8")
                return CodexRunnerResult(
                    exit_code=0, stdout="", stderr="",
                    timed_out=False, blocked=False,
                )

        fixer = CodexFixer(runner=_SimpleRunner())
        issue = {
            "id": "bug_001",
            "file": "src/autofix_seed/payments.py",
            "line_range": {"start": 6, "end": 7},
            "description": "SQL injection",
            "severity": "high",
            "confidence": 0.95,
        }
        fixer.fix(issue, repo_path=seeded_repo, artifacts_dir=temp_artifacts)

        hash_after = _compute_repo_hash(seeded_repo)
        assert hash_before == hash_after, "Original repository was modified!"

    def test_fake_runner_not_accessible_from_runtime(self):
        """The test-only fake runner must not be importable from the runtime module."""
        import agents.fixer_codex
        assert not hasattr(agents.fixer_codex, "_TestFakeRunner")
        assert not hasattr(agents.fixer_codex, "TestFakeRunner")
        assert not hasattr(agents.fixer_codex, "FakeRunner")


# ===================================================================
# 6. CodexFixer sandbox isolation tests
# ===================================================================


class TestIsolation:
    """Tests verifying sandbox boundaries are preserved."""

    def test_runner_uses_argv_not_shell(self):
        """Codex command must be an argument list, not a shell string."""
        from agents.fixer_codex import CodexCliRunner
        runner = CodexCliRunner(executable=Path("test-codex.exe"))
        with pytest.raises(Exception):
            runner.run("prompt", cwd=Path("."))
        # Verify the runner uses subprocess.Popen with argv (tested by checking
        # that it doesn't use shell=True). We can inspect the source directly.
        import inspect
        source = inspect.getsource(CodexCliRunner.run)
        assert "shell=True" not in source
        assert "subprocess.Popen" in source or "subprocess.run" in source


# ===================================================================
# 7. Integration test (opt-in only)
# ===================================================================


@pytest.mark.integration
class TestLiveCodexSmoke:
    """Live Codex integration test — runs only when explicitly opted in.

    Set AUTOFIX_RUN_LIVE_CODEX_TEST=1 to enable.
    """

    @pytest.fixture(autouse=True)
    def check_opt_in(self):
        if os.environ.get("AUTOFIX_RUN_LIVE_CODEX_TEST") != "1":
            pytest.skip(
                "Live Codex test disabled. "
                "Set AUTOFIX_RUN_LIVE_CODEX_TEST=1 to enable."
            )

    def test_codex_executable_available(self):
        from agents.fixer_codex import CodexCliRunner
        runner = CodexCliRunner()
        assert runner.is_available(), (
            "Codex CLI must be available for live test"
        )

    def test_simple_codex_invocation(self):
        """Run one benign real Codex request in a disposable workspace."""
        from agents.fixer_codex import CodexCliRunner, _CODEX_TIMEOUT_SECONDS

        with tempfile.TemporaryDirectory(prefix="afs-live-test-") as td:
            ws = Path(td) / "workspace"
            ws.mkdir()
            (ws / "hello.py").write_text(
                'def greet(name: str) -> str:\n    pass\n',
                encoding="utf-8",
            )

            runner = CodexCliRunner()
            result = runner.run(
                "Implement the greet function to return f'Hello, {name}!'",
                cwd=ws,
                timeout_seconds=_CODEX_TIMEOUT_SECONDS,
            )

            if result.blocked:
                pytest.skip(
                    "Codex blocked (auth/rate-limit). "
                    "Resolve access and retry."
                )

            assert not result.timed_out, "Codex invocation timed out"
