"""FastAPI backend for AutoFix Swarm.

This module provides the REST API for the AutoFix Swarm system, exposing
endpoints to trigger scans, fixes, verifications, and retrieve results.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import db
from backend.models import (
    AgentStatus,
    FixRequest,
    FixResponse,
    HealthResponse,
    PipelineResult,
    PipelineRunRequest,
    PipelineRunResponse,
    PipelineStatus,
    ScanRequest,
    ScanResponse,
    VerifyRequest,
    VerifyResponse,
)

# ---------------------------------------------------------------------------
# FastAPI App Initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AutoFix Swarm API",
    description="Autonomous bug detection and remediation agents",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def _check_codex_available() -> bool:
    """Check if Codex CLI is available."""
    try:
        from agents.fixer_codex import CodexCliRunner

        runner = CodexCliRunner()
        return runner.is_available()
    except Exception:
        return False


def _check_gpt_available() -> bool:
    """Check if GPT-5.6 API is configured."""
    return bool(settings.openai_api_key)


def _get_repo_path(override: Optional[str] = None) -> Path:
    """Get repository path with optional override."""
    if override:
        return Path(override).resolve()
    return settings.target_repo_path_resolved


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------


@app.get("/", tags=["General"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "AutoFix Swarm API",
        "version": "0.1.0",
        "status": "operational",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        codex_available=_check_codex_available(),
        gpt_available=_check_gpt_available(),
        database_connected=db.health_check(),
    )


@app.post("/scan", response_model=ScanResponse, tags=["Agents"])
async def scan_repository(request: ScanRequest):
    """Trigger a bug scan on the target repository.

    This endpoint invokes the Watcher agent to detect issues using
    Semgrep and/or GPT-5.6 gap analysis.

    Args:
        request: Scan configuration

    Returns:
        ScanResponse with issues found and scan metadata

    Raises:
        HTTPException: If scan fails or dependencies are unavailable
    """
    start_time = time.monotonic()
    scan_id = str(uuid.uuid4())
    repo_path = _get_repo_path(request.repo_path)

    # Validate repository path
    if not repo_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository path not found: {repo_path}",
        )

    try:
        # Run Watcher agent
        from agents.watcher import Watcher, WatcherConfig

        watcher_config = WatcherConfig(
            use_semgrep=request.use_semgrep,
            use_gpt=request.use_gpt,
            max_issues=request.max_issues,
            openai_api_key=settings.openai_api_key,
            openai_model=settings.openai_model,
        )
        watcher = Watcher(config=watcher_config)
        result = watcher.scan(repo_path)

        # Save issues to database
        for issue in result.issues:
            db.save_issue(
                issue_id=issue.id,
                run_id=scan_id,
                file=issue.file,
                line_start=issue.line_range["start"],
                line_end=issue.line_range["end"],
                description=issue.description,
                severity=issue.severity,
                confidence=issue.confidence,
                detectors=issue.detectors,
            )

        duration = time.monotonic() - start_time

        return ScanResponse(
            scan_id=scan_id,
            status=AgentStatus.SUCCEEDED,
            issues_found=result.total_count,
            duration_seconds=duration,
            message=f"Found {result.total_count} issues ({result.semgrep_count} from Semgrep, {result.gpt_count} from GPT)",
        )

    except Exception as e:
        duration = time.monotonic() - start_time
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {str(e)}",
        )


@app.post("/fix", response_model=FixResponse, tags=["Agents"])
async def fix_issue(request: FixRequest):
    """Fix a specific issue using Codex.

    This endpoint invokes the Codex Fixer agent to generate and apply
    a code fix for the specified issue.

    Args:
        request: Fix request with issue ID and optional issue data

    Returns:
        FixResponse with fix status and metadata

    Raises:
        HTTPException: If fix fails or Codex is unavailable
    """
    start_time = time.monotonic()
    fix_id = str(uuid.uuid4())

    # Check Codex availability
    if not _check_codex_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Codex CLI is not available or not authenticated",
        )

    try:
        # Run Codex Fixer
        from agents.fixer_codex import CodexFixer

        fixer = CodexFixer()
        
        # Use provided issue data or fetch from database
        issue_data = request.issue_data
        if not issue_data:
            # TODO: Fetch from database
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="issue_data must be provided or issue must exist in database",
            )

        result = fixer.fix(
            issue=issue_data,
            repo_path=settings.target_repo_path,
            artifacts_dir=settings.artifacts_dir,
        )

        # Save fix to database
        db.save_fix(
            fix_id=fix_id,
            issue_id=result.issue_id,
            run_id="standalone",  # No run_id for individual fix requests
            status=result.status,
            codex_live=result.codex_live,
            summary=result.summary,
            changed_files=result.changed_files,
            diff_text=result.diff,
            artifact_path=str(result.artifact_path) if result.artifact_path else None,
            duration_seconds=result.duration_seconds,
            failure_reason=result.failure_reason,
        )

        duration = time.monotonic() - start_time
        diff_preview = result.diff[:500] if result.diff else ""

        return FixResponse(
            fix_id=fix_id,
            issue_id=result.issue_id,
            status=AgentStatus(result.status),
            codex_live=result.codex_live,
            summary=result.summary,
            changed_files=result.changed_files,
            diff_preview=diff_preview,
            artifact_path=str(result.artifact_path) if result.artifact_path else None,
            duration_seconds=duration,
            failure_reason=result.failure_reason,
        )

    except HTTPException:
        raise
    except Exception as e:
        duration = time.monotonic() - start_time
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fix failed: {str(e)}",
        )


@app.post("/verify", response_model=VerifyResponse, tags=["Agents"])
async def verify_fix(request: VerifyRequest):
    """Verify a fix by running tests and generating explanation.

    This endpoint invokes the Reviewer agent to run the test suite
    against the patched code and generate a human-readable explanation.

    Args:
        request: Verification request with fix ID

    Returns:
        VerifyResponse with test results and explanation

    Raises:
        HTTPException: If verification fails
    """
    start_time = time.monotonic()
    verdict_id = str(uuid.uuid4())

    try:
        # Fetch fix from database
        # TODO: Implement database query for fix by fix_id
        # For now, assume repo_path and other data are available

        # Run Reviewer agent
        from agents.reviewer import Reviewer, ReviewerConfig

        reviewer_config = ReviewerConfig(
            openai_api_key=settings.openai_api_key,
            openai_model=settings.openai_model,
        )
        reviewer = Reviewer(config=reviewer_config)

        # TODO: Get actual issue_id, diff, and description from fix record
        result = reviewer.verify(
            issue_id="unknown",
            repo_path=settings.target_repo_path,
            diff="",  # Should come from fix record
            issue_description="",
        )

        # Save verdict to database
        db.save_verdict(
            verdict_id=verdict_id,
            fix_id=request.fix_id,
            issue_id=result.verdict.issue_id,
            run_id="standalone",
            status="succeeded",
            tests_passed=result.verdict.tests_passed,
            explanation=result.verdict.explanation,
            confidence=result.verdict.confidence,
            duration_seconds=result.duration_seconds,
        )

        duration = time.monotonic() - start_time

        return VerifyResponse(
            verdict_id=verdict_id,
            fix_id=request.fix_id,
            issue_id=result.verdict.issue_id,
            status=AgentStatus.SUCCEEDED,
            tests_passed=result.verdict.tests_passed,
            explanation=result.verdict.explanation,
            confidence=result.verdict.confidence,
            duration_seconds=duration,
        )

    except Exception as e:
        duration = time.monotonic() - start_time
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}",
        )


@app.post("/run", response_model=PipelineRunResponse, tags=["Pipeline"])
async def run_pipeline(request: PipelineRunRequest):
    """Run the complete pipeline: scan → fix → verify.

    This endpoint orchestrates all three agents in sequence:
    1. Watcher scans for bugs
    2. Codex fixes issues above confidence threshold
    3. Reviewer verifies each fix

    Args:
        request: Pipeline run configuration

    Returns:
        PipelineRunResponse with overall results and metrics

    Raises:
        HTTPException: If pipeline execution fails
    """
    start_time = time.monotonic()
    run_id = str(uuid.uuid4())
    repo_path = _get_repo_path(request.repo_path)

    # Validate repository
    if not repo_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository path not found: {repo_path}",
        )

    # Create pipeline run in database
    config = request.model_dump()
    db.create_pipeline_run(str(repo_path), config)

    try:
        # Run full pipeline using orchestrator
        from orchestrator.graph import Pipeline, PipelineConfig

        pipeline_config = PipelineConfig(
            repo_path=repo_path,
            use_semgrep=request.use_semgrep,
            use_gpt=request.use_gpt,
            max_issues=request.max_issues,
            auto_fix_threshold=request.auto_fix_threshold,
            artifacts_dir=settings.artifacts_dir,
            openai_api_key=settings.openai_api_key,
            openai_model=settings.openai_model,
        )

        pipeline = Pipeline()
        state = pipeline.run(pipeline_config)

        # Save all results to database
        # Save issues
        if state.watcher_result:
            for issue in state.watcher_result.issues:
                db.save_issue(
                    issue_id=issue.id,
                    run_id=run_id,
                    file=issue.file,
                    line_start=issue.line_range["start"],
                    line_end=issue.line_range["end"],
                    description=issue.description,
                    severity=issue.severity,
                    confidence=issue.confidence,
                    detectors=issue.detectors,
                )

        # Save fixes
        for fix_result in state.fix_results:
            db.save_fix(
                fix_id=str(uuid.uuid4()),
                issue_id=fix_result.issue_id,
                run_id=run_id,
                status=fix_result.status,
                codex_live=fix_result.codex_live,
                summary=fix_result.summary,
                changed_files=fix_result.changed_files,
                diff_text=fix_result.diff,
                artifact_path=(
                    str(fix_result.artifact_path) if fix_result.artifact_path else None
                ),
                duration_seconds=fix_result.duration_seconds,
                failure_reason=fix_result.failure_reason,
            )

        # Save verdicts
        for review_result in state.review_results:
            db.save_verdict(
                verdict_id=str(uuid.uuid4()),
                fix_id="",  # Would need to link to fix_id from earlier
                issue_id=review_result.verdict.issue_id,
                run_id=run_id,
                status="succeeded",
                tests_passed=review_result.verdict.tests_passed,
                explanation=review_result.verdict.explanation,
                confidence=review_result.verdict.confidence,
                duration_seconds=review_result.duration_seconds,
            )

        # Update pipeline run with final metrics
        db.update_pipeline_run(
            run_id=run_id,
            status=state.status,
            issues_found=state.issues_found,
            fixes_attempted=state.fixes_attempted,
            fixes_succeeded=state.fixes_succeeded,
            verifications_passed=state.verifications_passed,
            total_duration_seconds=state.duration_seconds,
        )

        duration = time.monotonic() - start_time

        return PipelineRunResponse(
            run_id=run_id,
            status=PipelineStatus(state.status.upper()),
            issues_found=state.issues_found,
            fixes_attempted=state.fixes_attempted,
            fixes_succeeded=state.fixes_succeeded,
            verifications_passed=state.verifications_passed,
            total_duration_seconds=duration,
            message=f"Pipeline completed: {state.issues_found} issues found, {state.fixes_succeeded} fixed, {state.verifications_passed} verified",
        )

    except Exception as e:
        db.update_pipeline_run(
            run_id=run_id,
            status="failed",
            total_duration_seconds=time.monotonic() - start_time,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution failed: {str(e)}",
        )


@app.get("/results/latest", response_model=PipelineResult, tags=["Results"])
async def get_latest_results():
    """Get the most recent pipeline run results.

    Returns:
        PipelineResult with complete execution details

    Raises:
        HTTPException: If no pipeline runs exist
    """
    run_data = db.get_latest_pipeline_run()

    if not run_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pipeline runs found",
        )

    # Parse and return full result
    # TODO: Implement full result assembly from database
    return PipelineResult(
        run_id=run_data["run_id"],
        status=PipelineStatus(run_data["status"]),
        total_duration_seconds=run_data.get("total_duration_seconds", 0.0),
        started_at=datetime.fromisoformat(run_data["started_at"]),
        completed_at=(
            datetime.fromisoformat(run_data["completed_at"])
            if run_data.get("completed_at")
            else None
        ),
    )


@app.get("/results/{run_id}", response_model=PipelineResult, tags=["Results"])
async def get_results(run_id: str):
    """Get results for a specific pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        PipelineResult with complete execution details

    Raises:
        HTTPException: If run_id not found
    """
    run_data = db.get_pipeline_run(run_id)

    if not run_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline run not found: {run_id}",
        )

    # Parse and return full result
    # TODO: Implement full result assembly from database
    return PipelineResult(
        run_id=run_data["run_id"],
        status=PipelineStatus(run_data["status"]),
        total_duration_seconds=run_data.get("total_duration_seconds", 0.0),
        started_at=datetime.fromisoformat(run_data["started_at"]),
        completed_at=(
            datetime.fromisoformat(run_data["completed_at"])
            if run_data.get("completed_at")
            else None
        ),
    )


@app.get("/issues/{run_id}", tags=["Results"])
async def get_issues(run_id: str):
    """Get all issues detected in a pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        List of issues with details

    Raises:
        HTTPException: If run_id not found
    """
    issues = db.get_issues(run_id)
    return {"run_id": run_id, "issues": issues, "count": len(issues)}


@app.get("/fixes/{run_id}", tags=["Results"])
async def get_fixes(run_id: str):
    """Get all fixes attempted in a pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        List of fixes with status and details

    Raises:
        HTTPException: If run_id not found
    """
    fixes = db.get_fixes(run_id)
    return {"run_id": run_id, "fixes": fixes, "count": len(fixes)}


@app.get("/verdicts/{run_id}", tags=["Results"])
async def get_verdicts(run_id: str):
    """Get all verification verdicts in a pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        List of verdicts with test results and explanations

    Raises:
        HTTPException: If run_id not found
    """
    verdicts = db.get_verdicts(run_id)
    return {"run_id": run_id, "verdicts": verdicts, "count": len(verdicts)}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "type": type(exc).__name__,
        },
    )


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    print("🚀 AutoFix Swarm API starting...")
    print(f"📁 Target repo: {settings.target_repo_path_resolved}")
    print(f"💾 Database: {db.db_path}")
    print(f"🔧 Codex available: {_check_codex_available()}")
    print(f"🤖 GPT-5.6 configured: {_check_gpt_available()}")
    print(f"🌐 API docs: http://{settings.api_host}:{settings.api_port}/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    print("👋 AutoFix Swarm API shutting down...")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )
