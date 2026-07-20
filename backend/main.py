"""FastAPI backend for AutoFix Swarm.

This module provides the REST API for the AutoFix Swarm system, exposing
endpoints to trigger scans, fixes, verifications, and retrieve results.
"""

from __future__ import annotations

import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

from fastapi import Body, FastAPI, File, HTTPException, UploadFile, status
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

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup then shutdown."""
    print("[startup] AutoFix Swarm API starting...")
    print(f"[startup] Target repo: {settings.target_repo_path_resolved}")
    print(f"[startup] Database: {db.db_path}")
    print(f"[startup] Codex available: {_check_codex_available()}")
    print(f"[startup] GPT-5.6 configured: {_check_gpt_available()}")
    print(f"[startup] API docs: http://{settings.api_host}:{settings.api_port}/docs")
    yield
    print("[shutdown] AutoFix Swarm API shutting down...")


app = FastAPI(
    title="AutoFix Swarm API",
    description="Autonomous bug detection and remediation agents",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
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
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )
        print(f"[SCAN] Config: semgrep={request.use_semgrep}, gpt={request.use_gpt}, model={settings.openai_model}")
        print(f"[SCAN] API key set: {bool(settings.openai_api_key)}")
        print(f"[SCAN] Repo path: {repo_path}")

        watcher = Watcher(config=watcher_config)
        print(f"[SCAN] Semgrep available: {Watcher._check_semgrep_available()}")

        result = watcher.scan(repo_path)
        print(f"[SCAN] Result: semgrep={result.semgrep_count}, gpt={result.gpt_count}, total={result.total_count}")

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
            repo_path=_get_repo_path(),
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
        # Fetch fix from database to get issue details
        fixes = db.get_fixes_by_fix_id(request.fix_id)
        if not fixes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fix not found: {request.fix_id}",
            )

        fix_data = fixes[0]
        issue_id = fix_data["issue_id"]
        diff_text = fix_data.get("diff_text") or ""

        # Get issue description from database
        issues = db.get_issue_by_id(issue_id)
        issue_description = issues[0]["description"] if issues else ""

        # Run Reviewer agent
        from agents.reviewer import Reviewer, ReviewerConfig

        reviewer_config = ReviewerConfig(
            openai_api_key=settings.openai_api_key,
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )
        reviewer = Reviewer(config=reviewer_config)

        result = reviewer.verify(
            issue_id=issue_id,
            repo_path=_get_repo_path(),
            diff=diff_text,
            issue_description=issue_description,
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
    db.create_pipeline_run(str(repo_path), config, run_id=run_id)

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
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )

        pipeline = Pipeline()
        state = pipeline.run(pipeline_config, run_id=run_id)

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

        # Save fixes — track fix_id per issue for verdict linking
        issue_to_fix_id: dict[str, str] = {}
        for fix_result in state.fix_results:
            fix_id = str(uuid.uuid4())
            issue_to_fix_id[fix_result.issue_id] = fix_id
            db.save_fix(
                fix_id=fix_id,
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

        # Save verdicts — link to fix_id via issue_id
        for review_result in state.review_results:
            fix_id = issue_to_fix_id.get(review_result.verdict.issue_id, "")
            db.save_verdict(
                verdict_id=str(uuid.uuid4()),
                fix_id=fix_id,
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

        # Auto-cache successful runs for demo fallback
        if state.status == "completed" and state.issues_found > 0:
            try:
                from backend.demo_cache import demo_cache

                issues_data = [i.to_dict() for i in (state.watcher_result.issues if state.watcher_result else [])]
                fixes_data = [
                    {
                        "fix_id": str(uuid.uuid4()),
                        "issue_id": f.issue_id,
                        "status": f.status,
                        "codex_live": f.codex_live,
                        "summary": f.summary,
                        "changed_files": f.changed_files,
                        "duration_seconds": f.duration_seconds,
                    }
                    for f in state.fix_results
                ]
                verdicts_data = [
                    {
                        "verdict_id": str(uuid.uuid4()),
                        "issue_id": r.verdict.issue_id,
                        "tests_passed": r.verdict.tests_passed,
                        "explanation": r.verdict.explanation,
                        "confidence": r.verdict.confidence,
                    }
                    for r in state.review_results
                ]

                pipeline_state = {
                    "run_id": run_id,
                    "status": state.status,
                    "issues_found": state.issues_found,
                    "fixes_attempted": state.fixes_attempted,
                    "fixes_succeeded": state.fixes_succeeded,
                    "verifications_passed": state.verifications_passed,
                    "total_duration_seconds": duration,
                    "issues": issues_data,
                    "fixes": fixes_data,
                    "verdicts": verdicts_data,
                }
                demo_cache.save_run(run_id, pipeline_state, settings.artifacts_dir)
            except Exception:
                # Cache failure is non-critical
                pass

        return PipelineRunResponse(
            run_id=run_id,
            status=PipelineStatus(state.status),
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


# ---------------------------------------------------------------------------
# Custom Code Pipeline Endpoints
# ---------------------------------------------------------------------------


@app.post("/run/custom", response_model=PipelineRunResponse, tags=["Pipeline"])
async def run_custom_pipeline(request_body: Optional[dict[str, Any]] = Body(default=None)):
    """Run pipeline against custom (pasted) code.

    Accepts code content, writes it to a temporary directory, then
    runs the full scan pipeline against it.

    Returns:
        PipelineRunResponse with results
    """
    if request_body is None:
        request_body = {}

    code = request_body.get("code", "")
    language = request_body.get("language", "python")
    use_semgrep = request_body.get("use_semgrep", True)
    use_gpt = request_body.get("use_gpt", True)

    if not code or not code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No code provided for analysis",
        )

    start_time = time.monotonic()
    run_id = str(uuid.uuid4())

    # Write custom code to a temporary repo directory
    import tempfile

    tmp_dir = Path(tempfile.mkdtemp(prefix="autofix-custom-"))
    try:
        # Create a source file with the pasted code
        ext_map = {
            "python": ".py",
            "javascript": ".js",
            "typescript": ".ts",
            "go": ".go",
            "rust": ".rs",
            "java": ".java",
            "c": ".c",
            "cpp": ".cpp",
            "solidity": ".sol",
        }
        ext = ext_map.get(language, ".py")
        src_file = tmp_dir / f"custom_code{ext}"
        src_file.write_text(code, encoding="utf-8")

        # Create minimal __init__.py for Python
        if language == "python":
            (tmp_dir / "__init__.py").write_text("")

        repo_path = tmp_dir

        # Create pipeline run
        config = {
            "use_semgrep": use_semgrep and language == "python",
            "use_gpt": use_gpt,
            "source": "custom_code",
            "language": language,
        }
        db.create_pipeline_run(str(repo_path), config, run_id=run_id)

        # Run watcher scan (only Semgrep for Python, GPT for all)
        from agents.watcher import Watcher, WatcherConfig

        raw_max = request_body.get("max_issues")
        max_issues = int(raw_max) if raw_max is not None else None

        watcher_config = WatcherConfig(
            use_semgrep=use_semgrep and language == "python",
            use_gpt=use_gpt,
            max_issues=max_issues,
            openai_api_key=settings.openai_api_key,
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )

        watcher = Watcher(config=watcher_config)
        result = watcher.scan(repo_path)

        # Save issues
        for issue in result.issues:
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

        duration = time.monotonic() - start_time

        # Update pipeline run
        db.update_pipeline_run(
            run_id=run_id,
            status="completed",
            issues_found=result.total_count,
            total_duration_seconds=duration,
        )

        return PipelineRunResponse(
            run_id=run_id,
            status=PipelineStatus.COMPLETED,
            issues_found=result.total_count,
            fixes_attempted=0,
            fixes_succeeded=0,
            verifications_passed=0,
            total_duration_seconds=duration,
            message=f"Custom code scan complete: {result.total_count} issues found",
        )

    except Exception as e:
        db.update_pipeline_run(
            run_id=run_id,
            status="failed",
            total_duration_seconds=time.monotonic() - start_time,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Custom pipeline failed: {str(e)}",
        )
    finally:
        # Clean up temp directory
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


@app.post("/run/custom/upload", response_model=PipelineRunResponse, tags=["Pipeline"])
async def run_custom_pipeline_upload(file: UploadFile = File(...)):
    """Run pipeline against an uploaded code file.

    Accepts multipart form data with a 'file' field, writes it to a
    temporary directory, then runs the scan pipeline against it.

    Returns:
        PipelineRunResponse with results
    """
    import tempfile

    start_time = time.monotonic()
    run_id = str(uuid.uuid4())

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )

    # Determine language from extension
    ext_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".go": "go", ".rs": "rust", ".java": "java",
        ".c": "c", ".cpp": "cpp", ".sol": "solidity",
        ".tsx": "typescript", ".jsx": "javascript",
    }
    suffix = Path(file.filename).suffix.lower()
    language = ext_map.get(suffix, "python")

    # Write uploaded content to temp directory
    tmp_dir = Path(tempfile.mkdtemp(prefix="autofix-upload-"))
    try:
        content = await file.read()
        src_file = tmp_dir / file.filename
        src_file.write_bytes(content)

        # Create __init__.py for Python
        if language == "python":
            (tmp_dir / "__init__.py").write_text("")

        repo_path = tmp_dir

        # Create pipeline run
        config = {
            "use_semgrep": language == "python",
            "use_gpt": True,
            "source": "upload",
            "language": language,
            "filename": file.filename,
        }
        db.create_pipeline_run(str(repo_path), config, run_id=run_id)

        # Run watcher scan
        from agents.watcher import Watcher, WatcherConfig

        watcher_config = WatcherConfig(
            use_semgrep=language == "python",
            use_gpt=True,
            openai_api_key=settings.openai_api_key,
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )

        watcher = Watcher(config=watcher_config)
        result = watcher.scan(repo_path)

        # Save issues
        for issue in result.issues:
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

        duration = time.monotonic() - start_time

        # Update pipeline run
        db.update_pipeline_run(
            run_id=run_id,
            status="completed",
            issues_found=result.total_count,
            total_duration_seconds=duration,
        )

        return PipelineRunResponse(
            run_id=run_id,
            status=PipelineStatus.COMPLETED,
            issues_found=result.total_count,
            fixes_attempted=0,
            fixes_succeeded=0,
            verifications_passed=0,
            total_duration_seconds=duration,
            message=f"Upload scan complete: {result.total_count} issues found in {file.filename}",
        )

    except HTTPException:
        raise
    except Exception as e:
        db.update_pipeline_run(
            run_id=run_id,
            status="failed",
            total_duration_seconds=time.monotonic() - start_time,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload pipeline failed: {str(e)}",
        )
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


# Legacy upload endpoint (kept for the dashboard's direct /upload call)
@app.post("/upload", tags=["Pipeline"])
async def upload_and_scan(file: UploadFile = File(...)):
    """Upload a code file and run analysis.

    Args:
        file: Uploaded code file

    Returns:
        Analysis results with issue count
    """
    import tempfile

    start_time = time.monotonic()
    run_id = str(uuid.uuid4())

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )

    # Determine language from extension
    ext_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".go": "go", ".rs": "rust", ".java": "java",
        ".c": "c", ".cpp": "cpp", ".sol": "solidity",
        ".tsx": "typescript", ".jsx": "javascript",
    }
    suffix = Path(file.filename).suffix.lower()
    language = ext_map.get(suffix, "python")

    # Write uploaded content to temp directory
    tmp_dir = Path(tempfile.mkdtemp(prefix="autofix-upload-"))
    try:
        content = await file.read()
        src_file = tmp_dir / file.filename
        src_file.write_bytes(content)

        # Create __init__.py for Python
        if language == "python":
            (tmp_dir / "__init__.py").write_text("")

        repo_path = tmp_dir

        # Create pipeline run
        config = {
            "use_semgrep": language == "python",
            "use_gpt": True,
            "source": "upload",
            "language": language,
            "filename": file.filename,
        }
        db.create_pipeline_run(str(repo_path), config, run_id=run_id)

        # Run watcher scan
        from agents.watcher import Watcher, WatcherConfig

        watcher_config = WatcherConfig(
            use_semgrep=language == "python",
            use_gpt=True,
            openai_api_key=settings.openai_api_key,
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
        )

        watcher = Watcher(config=watcher_config)
        result = watcher.scan(repo_path)

        # Save issues
        for issue in result.issues:
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

        duration = time.monotonic() - start_time

        # Update pipeline run
        db.update_pipeline_run(
            run_id=run_id,
            status="completed",
            issues_found=result.total_count,
            total_duration_seconds=duration,
        )

        return {
            "run_id": run_id,
            "issues_found": result.total_count,
            "filename": file.filename,
            "language": language,
            "duration_seconds": duration,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.update_pipeline_run(
            run_id=run_id,
            status="failed",
            total_duration_seconds=time.monotonic() - start_time,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload analysis failed: {str(e)}",
        )
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


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

    return PipelineResult(
        run_id=run_data["run_id"],
        status=PipelineStatus(run_data["status"]),
        issues_found=run_data.get("issues_found") or 0,
        fixes_attempted=run_data.get("fixes_attempted") or 0,
        fixes_succeeded=run_data.get("fixes_succeeded") or 0,
        verifications_passed=run_data.get("verifications_passed") or 0,
        total_duration_seconds=run_data.get("total_duration_seconds") or 0.0,
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

    return PipelineResult(
        run_id=run_data["run_id"],
        status=PipelineStatus(run_data["status"]),
        issues_found=run_data.get("issues_found") or 0,
        fixes_attempted=run_data.get("fixes_attempted") or 0,
        fixes_succeeded=run_data.get("fixes_succeeded") or 0,
        verifications_passed=run_data.get("verifications_passed") or 0,
        total_duration_seconds=run_data.get("total_duration_seconds") or 0.0,
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
    """
    import json as _json

    rows = db.get_issues(run_id)
    issues = []
    for row in rows:
        detectors = row.get("detectors", "[]")
        if isinstance(detectors, str):
            try:
                detectors = _json.loads(detectors)
            except Exception:
                detectors = []
        issues.append({
            "id": row["issue_id"],
            "file": row["file"],
            "line_range": {"start": row["line_start"], "end": row["line_end"]},
            "description": row["description"],
            "severity": row["severity"],
            "confidence": row["confidence"],
            "detectors": detectors,
        })
    return {"run_id": run_id, "issues": issues, "count": len(issues)}


@app.get("/fixes/{run_id}", tags=["Results"])
async def get_fixes(run_id: str):
    """Get all fixes attempted in a pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        List of fixes with status and details
    """
    import json as _json

    rows = db.get_fixes(run_id)
    fixes = []
    for row in rows:
        changed_files = row.get("changed_files", "[]")
        if isinstance(changed_files, str):
            try:
                changed_files = _json.loads(changed_files)
            except Exception:
                changed_files = []
        fixes.append({
            "fix_id": row["fix_id"],
            "issue_id": row["issue_id"],
            "status": row["status"],
            "codex_live": bool(row["codex_live"]),
            "summary": row["summary"],
            "changed_files": changed_files,
            "diff_preview": (row.get("diff_text") or "")[:500] if row.get("diff_text") else "",
            "artifact_path": row.get("artifact_path"),
            "duration_seconds": row["duration_seconds"],
            "failure_reason": row.get("failure_reason", ""),
            "timestamp": row.get("created_at", ""),
        })
    return {"run_id": run_id, "fixes": fixes, "count": len(fixes)}


@app.get("/verdicts/{run_id}", tags=["Results"])
async def get_verdicts(run_id: str):
    """Get all verification verdicts in a pipeline run.

    Args:
        run_id: Unique identifier for the pipeline run

    Returns:
        List of verdicts with test results and explanations
    """
    rows = db.get_verdicts(run_id)
    verdicts = []
    for row in rows:
        verdicts.append({
            "verdict_id": row["verdict_id"],
            "fix_id": row["fix_id"],
            "issue_id": row["issue_id"],
            "status": row["status"],
            "tests_passed": bool(row["tests_passed"]),
            "explanation": row["explanation"],
            "confidence": row["confidence"],
            "duration_seconds": row["duration_seconds"],
            "timestamp": row.get("created_at", ""),
        })
    return {"run_id": run_id, "verdicts": verdicts, "count": len(verdicts)}


# ---------------------------------------------------------------------------
# Demo Cache Endpoints
# ---------------------------------------------------------------------------


@app.get("/demo/cached", tags=["Demo"])
async def get_cached_demo():
    """Get the latest cached demo run for fallback replay.

    Returns:
        Cached pipeline data ready for dashboard display, or 404 if none cached
    """
    from backend.demo_cache import demo_cache

    demo_data = demo_cache.get_demo_data()
    if not demo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached demo runs available",
        )
    return demo_data


@app.get("/demo/cached/list", tags=["Demo"])
async def list_cached_demos():
    """List all cached demo runs.

    Returns:
        List of cached run metadata
    """
    from backend.demo_cache import demo_cache

    runs = demo_cache.list_runs()
    return {"runs": runs, "count": len(runs)}


@app.post("/demo/cache/{run_id}", tags=["Demo"])
async def cache_pipeline_run(run_id: str):
    """Cache a completed pipeline run for demo fallback.

    Args:
        run_id: The run_id from a completed pipeline execution

    Returns:
        Confirmation with cache location
    """
    from backend.demo_cache import demo_cache

    # Fetch run from database
    run_data = db.get_pipeline_run(run_id)
    if not run_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline run not found: {run_id}",
        )

    # Assemble full state
    issues = db.get_issues(run_id)
    fixes = db.get_fixes(run_id)
    verdicts = db.get_verdicts(run_id)

    pipeline_state = {
        "run_id": run_id,
        "status": run_data.get("status", "completed"),
        "issues_found": run_data.get("issues_found", len(issues)),
        "fixes_attempted": run_data.get("fixes_attempted", len(fixes)),
        "fixes_succeeded": run_data.get("fixes_succeeded", 0),
        "verifications_passed": run_data.get("verifications_passed", 0),
        "total_duration_seconds": run_data.get("total_duration_seconds", 0),
        "issues": issues,
        "fixes": fixes,
        "verdicts": verdicts,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }

    cache_path = demo_cache.save_run(run_id, pipeline_state, settings.artifacts_dir)

    return {
        "status": "cached",
        "run_id": run_id,
        "cache_path": cache_path,
        "message": f"Run {run_id} cached for demo fallback",
    }


@app.delete("/demo/cache/{run_id}", tags=["Demo"])
async def delete_cached_demo(run_id: str):
    """Delete a cached demo run.

    Args:
        run_id: Run identifier to delete from cache

    Returns:
        Deletion confirmation
    """
    from backend.demo_cache import demo_cache

    deleted = demo_cache.delete_run(run_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cached run not found: {run_id}",
        )

    return {"status": "deleted", "run_id": run_id}


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
