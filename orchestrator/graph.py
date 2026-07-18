"""LangGraph orchestrator for AutoFix Swarm pipeline.

Coordinates the three agents in sequence:
Watcher → Codex Fixer → Reviewer
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from agents.fixer_codex import CodexFixer, FixResult
from agents.reviewer import Reviewer, ReviewerResult
from agents.watcher import Watcher, WatcherResult

__all__ = [
    "PipelineState",
    "PipelineConfig",
    "Pipeline",
    "PipelineError",
]


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class PipelineConfig:
    """Configuration for the full pipeline."""

    repo_path: str | Path
    use_semgrep: bool = True
    use_gpt: bool = True
    max_issues: Optional[int] = None
    auto_fix_threshold: float = 0.7
    artifacts_dir: str | Path = "artifacts"
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openai_model: str = "nvidia/nemotron-3-ultra-550b-a55b:free"


@dataclass
class PipelineState:
    """State passed between pipeline stages."""

    run_id: str
    config: PipelineConfig
    status: str = "idle"

    # Watcher output
    watcher_result: Optional[WatcherResult] = None

    # Fixer output (one per issue)
    fix_results: list[FixResult] = field(default_factory=list)

    # Reviewer output (one per fix)
    review_results: list[ReviewerResult] = field(default_factory=list)

    # Timing
    started_at: float = field(default_factory=time.monotonic)
    completed_at: Optional[float] = None

    # Errors
    errors: list[str] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        """Calculate total duration."""
        if self.completed_at:
            return self.completed_at - self.started_at
        return time.monotonic() - self.started_at

    @property
    def issues_found(self) -> int:
        """Total issues found by Watcher."""
        return len(self.watcher_result.issues) if self.watcher_result else 0

    @property
    def fixes_attempted(self) -> int:
        """Total fixes attempted."""
        return len(self.fix_results)

    @property
    def fixes_succeeded(self) -> int:
        """Fixes that completed successfully."""
        return sum(1 for f in self.fix_results if f.status == "succeeded")

    @property
    def verifications_passed(self) -> int:
        """Fixes that passed verification tests."""
        return sum(
            1 for r in self.review_results if r.verdict.tests_passed
        )


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class PipelineError(Exception):
    """Base exception for pipeline failures."""


# ---------------------------------------------------------------------------
# Pipeline Orchestrator
# ---------------------------------------------------------------------------


class Pipeline:
    """Orchestrates the three-agent pipeline: Watcher → Fixer → Reviewer.

    This is a simplified linear pipeline for v1. Each stage runs sequentially.
    No retry loop is implemented (as per design spec).
    """

    def __init__(self) -> None:
        """Initialize pipeline components."""
        self.watcher: Optional[Watcher] = None
        self.fixer: Optional[CodexFixer] = None
        self.reviewer: Optional[Reviewer] = None

    def run(self, config: PipelineConfig) -> PipelineState:
        """Run the complete pipeline.

        Args:
            config: Pipeline configuration

        Returns:
            PipelineState with all results

        Raises:
            PipelineError: If pipeline execution fails
        """
        # Initialize state
        run_id = str(uuid.uuid4())
        state = PipelineState(run_id=run_id, config=config)

        try:
            # Stage 1: Watcher (Bug Detection)
            state.status = "scanning"
            state = self._run_watcher(state)

            # Stage 2: Codex Fixer (Fix Generation)
            if state.watcher_result and state.watcher_result.issues:
                state.status = "fixing"
                state = self._run_fixer(state)

            # Stage 3: Reviewer (Verification)
            if state.fix_results:
                state.status = "verifying"
                state = self._run_reviewer(state)

            # Mark as completed
            state.status = "completed"
            state.completed_at = time.monotonic()

        except Exception as e:
            state.status = "failed"
            state.errors.append(str(e))
            state.completed_at = time.monotonic()
            raise PipelineError(f"Pipeline execution failed: {e}") from e

        return state

    def _run_watcher(self, state: PipelineState) -> PipelineState:
        """Run Watcher agent.

        Args:
            state: Current pipeline state

        Returns:
            Updated state with Watcher results
        """
        from agents.watcher import WatcherConfig

        if self.watcher is None:
            watcher_config = WatcherConfig(
                use_semgrep=state.config.use_semgrep,
                use_gpt=state.config.use_gpt,
                max_issues=state.config.max_issues,
                openai_api_key=state.config.openai_api_key,
                openai_base_url=state.config.openai_base_url,
                openai_model=state.config.openai_model,
            )
            self.watcher = Watcher(config=watcher_config)

        result = self.watcher.scan(state.config.repo_path)
        state.watcher_result = result

        return state

    def _run_fixer(self, state: PipelineState) -> PipelineState:
        """Run Codex Fixer agent for each issue above threshold.

        Args:
            state: Current pipeline state

        Returns:
            Updated state with fix results
        """
        if self.fixer is None:
            self.fixer = CodexFixer()

        if not state.watcher_result:
            return state

        # Convert artifacts_dir to Path
        artifacts_dir = Path(state.config.artifacts_dir)
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        # Fix each issue that meets confidence threshold
        for issue in state.watcher_result.issues:
            if issue.confidence < state.config.auto_fix_threshold:
                # Skip low-confidence issues
                continue

            try:
                # Convert Issue to dict format expected by CodexFixer
                issue_dict = issue.to_dict()

                fix_result = self.fixer.fix(
                    issue=issue_dict,
                    repo_path=state.config.repo_path,
                    artifacts_dir=artifacts_dir,
                )

                state.fix_results.append(fix_result)

            except Exception as e:
                # Log error but continue with other issues
                state.errors.append(
                    f"Failed to fix issue {issue.id}: {str(e)}"
                )
                continue

        return state

    def _run_reviewer(self, state: PipelineState) -> PipelineState:
        """Run Reviewer agent for each successful fix.

        Args:
            state: Current pipeline state

        Returns:
            Updated state with verification results
        """
        from agents.reviewer import ReviewerConfig

        if self.reviewer is None:
            reviewer_config = ReviewerConfig(
                openai_api_key=state.config.openai_api_key,
                openai_base_url=state.config.openai_base_url,
                openai_model=state.config.openai_model,
            )
            self.reviewer = Reviewer(config=reviewer_config)

        # Get original issue descriptions
        issue_map = {}
        if state.watcher_result:
            for issue in state.watcher_result.issues:
                issue_map[issue.id] = issue.description

        # Review each successful fix
        for fix_result in state.fix_results:
            if fix_result.status != "succeeded":
                # Skip failed fixes
                continue

            try:
                issue_description = issue_map.get(fix_result.issue_id, "")

                review_result = self.reviewer.verify(
                    issue_id=fix_result.issue_id,
                    repo_path=state.config.repo_path,
                    diff=fix_result.diff,
                    issue_description=issue_description,
                )

                state.review_results.append(review_result)

            except Exception as e:
                # Log error but continue with other fixes
                state.errors.append(
                    f"Failed to review fix for {fix_result.issue_id}: {str(e)}"
                )
                continue

        return state


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def create_pipeline() -> Pipeline:
    """Create a new pipeline instance.

    Returns:
        Initialized Pipeline
    """
    return Pipeline()


def run_pipeline(config: PipelineConfig) -> PipelineState:
    """Convenience function to create and run a pipeline.

    Args:
        config: Pipeline configuration

    Returns:
        PipelineState with results
    """
    pipeline = create_pipeline()
    return pipeline.run(config)
