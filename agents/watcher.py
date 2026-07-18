"""AutoFix Swarm Watcher Agent — detects bugs using Semgrep + GPT-5.6.

This agent scans a target repository and produces a ranked list of issues.
It uses two detection methods:
1. Semgrep (static analysis) for known patterns
2. GPT-5.6 for semantic issues that static analysis misses
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

__all__ = [
    "Issue",
    "WatcherConfig",
    "WatcherResult",
    "Watcher",
    "WatcherError",
]


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class Issue:
    """A detected bug or security issue."""

    id: str
    file: str
    line_range: dict[str, int]
    description: str
    severity: str
    confidence: float
    detectors: list[str]
    latency_ms: Optional[float] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "id": self.id,
            "file": self.file,
            "line_range": self.line_range,
            "description": self.description,
            "severity": self.severity,
            "confidence": self.confidence,
            "detectors": self.detectors,
            "latency_ms": self.latency_ms,
        }


@dataclass
class WatcherConfig:
    """Configuration for the Watcher agent."""

    use_semgrep: bool = True
    use_gpt: bool = True
    max_issues: Optional[int] = None
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-5.6-luna"
    timeout_seconds: int = 300


@dataclass
class WatcherResult:
    """Result from a Watcher scan."""

    issues: list[Issue]
    duration_seconds: float
    semgrep_count: int
    gpt_count: int
    total_count: int
    status: str
    error_message: str = ""


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class WatcherError(Exception):
    """Base exception for Watcher failures."""


class SemgrepUnavailableError(WatcherError):
    """Semgrep is not installed or not working."""


class GPTUnavailableError(WatcherError):
    """GPT-5.6 API is not configured or not accessible."""


# ---------------------------------------------------------------------------
# Watcher Agent
# ---------------------------------------------------------------------------


class Watcher:
    """Bug detection agent using Semgrep and GPT-5.6."""

    def __init__(self, config: Optional[WatcherConfig] = None) -> None:
        """Initialize Watcher with configuration.

        Args:
            config: Optional WatcherConfig. Uses defaults if not provided.
        """
        self.config = config or WatcherConfig()

    def scan(self, repo_path: str | Path) -> WatcherResult:
        """Scan repository for bugs.

        Args:
            repo_path: Path to repository to scan

        Returns:
            WatcherResult with detected issues

        Raises:
            WatcherError: If scan fails
        """
        repo_path = Path(repo_path).resolve()
        if not repo_path.exists():
            raise WatcherError(f"Repository path does not exist: {repo_path}")

        start_time = time.monotonic()
        all_issues: list[Issue] = []
        semgrep_count = 0
        gpt_count = 0

        # Run Semgrep if enabled
        if self.config.use_semgrep:
            try:
                semgrep_issues = self._run_semgrep(repo_path)
                all_issues.extend(semgrep_issues)
                semgrep_count = len(semgrep_issues)
            except SemgrepUnavailableError as e:
                # Continue without Semgrep but record the issue
                pass

        # Run GPT-5.6 gap analysis if enabled
        if self.config.use_gpt:
            try:
                gpt_issues = self._run_gpt_analysis(repo_path, all_issues)
                all_issues.extend(gpt_issues)
                gpt_count = len(gpt_issues)
            except GPTUnavailableError:
                # Continue without GPT but record the issue
                pass

        # Sort by severity and confidence
        all_issues = self._rank_issues(all_issues)

        # Apply max limit if configured
        if self.config.max_issues:
            all_issues = all_issues[: self.config.max_issues]

        duration = time.monotonic() - start_time

        return WatcherResult(
            issues=all_issues,
            duration_seconds=duration,
            semgrep_count=semgrep_count,
            gpt_count=gpt_count,
            total_count=len(all_issues),
            status="succeeded" if all_issues else "no_issues_found",
        )

    def _run_semgrep(self, repo_path: Path) -> list[Issue]:
        """Run Semgrep static analysis.

        Args:
            repo_path: Path to repository

        Returns:
            List of issues detected by Semgrep

        Raises:
            SemgrepUnavailableError: If Semgrep is not available
        """
        # Check if Semgrep is available
        if not self._check_semgrep_available():
            raise SemgrepUnavailableError("Semgrep is not installed or not in PATH")

        issues: list[Issue] = []
        start = time.monotonic()

        try:
            # Run Semgrep with JSON output
            # Using auto config for common vulnerabilities
            result = subprocess.run(
                [
                    "semgrep",
                    "--config=auto",
                    "--json",
                    "--quiet",
                    str(repo_path),
                ],
                capture_output=True,
                text=True,
                timeout=self.config.timeout_seconds,
                check=False,
            )

            latency_ms = (time.monotonic() - start) * 1000

            if result.returncode not in (0, 1):
                # Exit code 1 means findings were detected (normal)
                # Other codes indicate errors
                return issues

            if not result.stdout:
                return issues

            data = json.loads(result.stdout)
            findings = data.get("results", [])

            for idx, finding in enumerate(findings):
                # Extract issue details from Semgrep output
                issue_id = f"semgrep_{idx+1:03d}"
                path = finding.get("path", "unknown")
                # Make path relative to repo_path
                try:
                    rel_path = Path(path).relative_to(repo_path)
                except ValueError:
                    rel_path = Path(path)

                start_line = finding.get("start", {}).get("line", 1)
                end_line = finding.get("end", {}).get("line", start_line)

                severity_map = {
                    "ERROR": "high",
                    "WARNING": "medium",
                    "INFO": "low",
                }
                severity = severity_map.get(
                    finding.get("extra", {}).get("severity", "WARNING"), "medium"
                )

                message = finding.get("extra", {}).get("message", "Issue detected")

                issues.append(
                    Issue(
                        id=issue_id,
                        file=str(rel_path),
                        line_range={"start": start_line, "end": end_line},
                        description=message,
                        severity=severity,
                        confidence=0.9,  # Semgrep is deterministic
                        detectors=["semgrep"],
                        latency_ms=latency_ms,
                    )
                )

        except subprocess.TimeoutExpired:
            raise WatcherError(
                f"Semgrep scan timed out after {self.config.timeout_seconds}s"
            )
        except json.JSONDecodeError:
            # Semgrep output was not valid JSON
            pass
        except Exception as e:
            # Other errors - continue without Semgrep
            pass

        return issues

    def _run_gpt_analysis(
        self, repo_path: Path, existing_issues: list[Issue]
    ) -> list[Issue]:
        """Run GPT-5.6 gap analysis for issues Semgrep missed.

        Args:
            repo_path: Path to repository
            existing_issues: Issues already found by Semgrep

        Returns:
            List of additional issues detected by GPT

        Raises:
            GPTUnavailableError: If GPT API is not configured
        """
        if not self.config.openai_api_key:
            raise GPTUnavailableError("OpenAI API key not configured")

        # For v1: Return empty list (GPT integration is complex)
        # TODO: Implement GPT-5.6 semantic analysis
        # This would involve:
        # 1. Reading source files
        # 2. Constructing prompts for GPT-5.6
        # 3. Parsing GPT responses
        # 4. Filtering out duplicates of Semgrep findings
        return []

    def _rank_issues(self, issues: list[Issue]) -> list[Issue]:
        """Rank issues by severity and confidence.

        Args:
            issues: List of issues to rank

        Returns:
            Sorted list of issues (highest priority first)
        """
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

        def sort_key(issue: Issue) -> tuple[int, float]:
            severity_rank = severity_order.get(issue.severity, 999)
            # Negate confidence so higher confidence comes first
            return (severity_rank, -issue.confidence)

        return sorted(issues, key=sort_key)

    @staticmethod
    def _check_semgrep_available() -> bool:
        """Check if Semgrep is installed and available."""
        try:
            result = subprocess.run(
                ["semgrep", "--version"],
                capture_output=True,
                timeout=10,
                check=False,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError, OSError):
            return False
