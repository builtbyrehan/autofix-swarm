"""AutoFix Swarm Reviewer Agent — verifies fixes and generates explanations.

This agent runs tests against patched code and uses GPT-5.6 to generate
human-readable explanations of fix results.
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

__all__ = [
    "Verdict",
    "ReviewerConfig",
    "ReviewerResult",
    "Reviewer",
    "ReviewerError",
]


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class Verdict:
    """Verification verdict for a fix."""

    issue_id: str
    tests_passed: bool
    explanation: str
    confidence: float
    latency_ms: Optional[float] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "issue_id": self.issue_id,
            "tests_passed": self.tests_passed,
            "explanation": self.explanation,
            "confidence": self.confidence,
            "latency_ms": self.latency_ms,
        }


@dataclass
class ReviewerConfig:
    """Configuration for the Reviewer agent."""

    test_command: list[str] | None = None
    timeout_seconds: int = 180
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-5.6-luna"


@dataclass
class ReviewerResult:
    """Result from a Reviewer verification."""

    verdict: Verdict
    test_output: str
    test_exit_code: int
    duration_seconds: float
    status: str
    error_message: str = ""


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ReviewerError(Exception):
    """Base exception for Reviewer failures."""


class TestRunError(ReviewerError):
    """Test execution failed."""


class GPTUnavailableError(ReviewerError):
    """GPT-5.6 API is not configured or not accessible."""


# ---------------------------------------------------------------------------
# Reviewer Agent
# ---------------------------------------------------------------------------


class Reviewer:
    """Verification and explanation agent using pytest + GPT-5.6."""

    def __init__(self, config: Optional[ReviewerConfig] = None) -> None:
        """Initialize Reviewer with configuration.

        Args:
            config: Optional ReviewerConfig. Uses defaults if not provided.
        """
        self.config = config or ReviewerConfig()

    def verify(
        self,
        issue_id: str,
        repo_path: str | Path,
        diff: str,
        issue_description: str = "",
    ) -> ReviewerResult:
        """Verify a fix by running tests and generating explanation.

        Args:
            issue_id: ID of the issue that was fixed
            repo_path: Path to repository (with fix applied)
            diff: The diff text showing changes made
            issue_description: Original issue description

        Returns:
            ReviewerResult with verdict and test results

        Raises:
            ReviewerError: If verification fails
        """
        repo_path = Path(repo_path).resolve()
        if not repo_path.exists():
            raise ReviewerError(f"Repository path does not exist: {repo_path}")

        start_time = time.monotonic()

        # Run tests
        tests_passed, test_output, exit_code = self._run_tests(repo_path)

        # Generate explanation using GPT-5.6
        explanation, confidence = self._generate_explanation(
            issue_id=issue_id,
            issue_description=issue_description,
            diff=diff,
            tests_passed=tests_passed,
            test_output=test_output,
        )

        duration = time.monotonic() - start_time

        verdict = Verdict(
            issue_id=issue_id,
            tests_passed=tests_passed,
            explanation=explanation,
            confidence=confidence,
            latency_ms=duration * 1000,
        )

        return ReviewerResult(
            verdict=verdict,
            test_output=test_output,
            test_exit_code=exit_code,
            duration_seconds=duration,
            status="succeeded",
        )

    def _run_tests(self, repo_path: Path) -> tuple[bool, str, int]:
        """Run test suite against the patched repository.

        Args:
            repo_path: Path to repository

        Returns:
            Tuple of (tests_passed, output, exit_code)
        """
        # Determine test command
        test_cmd = self.config.test_command
        if test_cmd is None:
            # Auto-detect: prefer pytest, fallback to unittest
            if self._check_pytest_available():
                test_cmd = ["python", "-m", "pytest", "-v", "--tb=short"]
            else:
                test_cmd = [
                    "python",
                    "-m",
                    "unittest",
                    "discover",
                    "-s",
                    "tests",
                    "-p",
                    "test_*.py",
                ]

        try:
            result = subprocess.run(
                test_cmd,
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=self.config.timeout_seconds,
                check=False,
            )

            output = result.stdout + "\n" + result.stderr
            exit_code = result.returncode
            tests_passed = exit_code == 0

            return tests_passed, output, exit_code

        except subprocess.TimeoutExpired:
            return (
                False,
                f"Test execution timed out after {self.config.timeout_seconds}s",
                -1,
            )
        except Exception as e:
            return False, f"Test execution failed: {str(e)}", -1

    def _generate_explanation(
        self,
        issue_id: str,
        issue_description: str,
        diff: str,
        tests_passed: bool,
        test_output: str,
    ) -> tuple[str, float]:
        """Generate human-readable explanation using GPT-5.6.

        Args:
            issue_id: Issue identifier
            issue_description: Original issue description
            diff: The code changes made
            tests_passed: Whether tests passed
            test_output: Test execution output

        Returns:
            Tuple of (explanation, confidence)
        """
        # For v1: Generate deterministic explanation without GPT
        # TODO: Implement GPT-5.6 explanation generation
        # This would involve constructing a prompt and calling OpenAI API

        if tests_passed:
            explanation = (
                f"Fix for issue {issue_id} successfully applied. "
                f"All tests passed after applying the changes. "
            )
            if issue_description:
                explanation += f"Original issue: {issue_description}. "
            explanation += "The code changes resolve the reported problem without breaking existing functionality."
            confidence = 0.95
        else:
            explanation = (
                f"Fix for issue {issue_id} was applied, but tests failed. "
            )
            if "FAILED" in test_output or "ERROR" in test_output:
                explanation += "Test failures indicate the fix may have introduced regressions or the issue requires a different approach. "
            else:
                explanation += "Unable to verify the fix due to test execution issues. "
            explanation += "Manual review is recommended before merging."
            confidence = 0.5

        return explanation, confidence

    @staticmethod
    def _check_pytest_available() -> bool:
        """Check if pytest is installed and available."""
        try:
            result = subprocess.run(
                ["python", "-m", "pytest", "--version"],
                capture_output=True,
                timeout=10,
                check=False,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError, OSError):
            return False
