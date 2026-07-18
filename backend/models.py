"""Data models for the AutoFix Swarm backend API."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SeverityLevel(str, Enum):
    """Issue severity levels matching Watcher contract."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AgentStatus(str, Enum):
    """Status of an agent execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    BLOCKED = "blocked"
    REJECTED = "rejected"


class PipelineStatus(str, Enum):
    """Overall pipeline execution status."""

    IDLE = "idle"
    SCANNING = "scanning"
    FIXING = "fixing"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------


class ScanRequest(BaseModel):
    """Request to trigger a bug scan."""

    repo_path: Optional[str] = Field(
        None,
        description="Optional override for target repository path",
    )
    use_semgrep: bool = Field(True, description="Enable Semgrep static analysis")
    use_gpt: bool = Field(True, description="Enable GPT-5.6 gap analysis")
    max_issues: Optional[int] = Field(
        None,
        description="Maximum number of issues to return",
    )


class ScanResponse(BaseModel):
    """Response from a bug scan operation."""

    scan_id: str = Field(..., description="Unique identifier for this scan")
    status: AgentStatus
    issues_found: int
    duration_seconds: float
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FixRequest(BaseModel):
    """Request to fix a specific issue."""

    issue_id: str = Field(..., description="ID of the issue to fix")
    issue_data: Optional[dict[str, Any]] = Field(
        None,
        description="Full issue data if not already in database",
    )


class FixResponse(BaseModel):
    """Response from a fix operation."""

    fix_id: str = Field(..., description="Unique identifier for this fix")
    issue_id: str
    status: AgentStatus
    codex_live: bool = Field(
        ...,
        description="Whether this was a real Codex invocation",
    )
    summary: str
    changed_files: list[str] = Field(default_factory=list)
    diff_preview: str = Field("", description="First 500 chars of diff")
    artifact_path: Optional[str] = None
    duration_seconds: float
    failure_reason: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class VerifyRequest(BaseModel):
    """Request to verify a fix."""

    fix_id: str = Field(..., description="ID of the fix to verify")


class VerifyResponse(BaseModel):
    """Response from a verification operation."""

    verdict_id: str = Field(..., description="Unique identifier for this verdict")
    fix_id: str
    issue_id: str
    status: AgentStatus
    tests_passed: bool
    explanation: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    duration_seconds: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PipelineRunRequest(BaseModel):
    """Request to run the full pipeline (scan → fix → verify)."""

    repo_path: Optional[str] = None
    use_semgrep: bool = True
    use_gpt: bool = True
    max_issues: Optional[int] = None
    auto_fix_threshold: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Minimum confidence to auto-fix an issue",
    )


class PipelineRunResponse(BaseModel):
    """Response from a full pipeline run."""

    run_id: str = Field(..., description="Unique identifier for this pipeline run")
    status: PipelineStatus
    issues_found: int
    fixes_attempted: int
    fixes_succeeded: int
    verifications_passed: int
    total_duration_seconds: float
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Issue Model (Watcher output)
# ---------------------------------------------------------------------------


class LineRange(BaseModel):
    """Line range within a file."""

    start: int = Field(..., ge=1, description="Start line (1-indexed)")
    end: int = Field(..., ge=1, description="End line (1-indexed)")

    @field_validator("end")
    @classmethod
    def end_must_be_gte_start(cls, v: int, info) -> int:
        """Validate that end >= start."""
        if "start" in info.data and v < info.data["start"]:
            raise ValueError("end must be >= start")
        return v


class Issue(BaseModel):
    """Watcher-detected issue matching the contract schema."""

    id: str = Field(..., min_length=1)
    file: str = Field(..., min_length=1)
    line_range: LineRange
    description: str = Field(..., min_length=1)
    severity: SeverityLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    detectors: list[str] = Field(default_factory=list)
    latency_ms: Optional[float] = Field(None, ge=0)

    class Config:
        """Pydantic config."""

        use_enum_values = True


# ---------------------------------------------------------------------------
# Results/Status Models
# ---------------------------------------------------------------------------


class AgentLog(BaseModel):
    """Single agent execution log entry."""

    log_id: int
    run_id: str
    agent_name: str  # "watcher", "fixer", "reviewer"
    status: AgentStatus
    input_data: dict[str, Any]
    output_data: dict[str, Any]
    duration_seconds: float
    error_message: str = ""
    timestamp: datetime


class PipelineResult(BaseModel):
    """Complete pipeline execution result."""

    run_id: str
    status: PipelineStatus
    scan_result: Optional[ScanResponse] = None
    fix_results: list[FixResponse] = Field(default_factory=list)
    verify_results: list[VerifyResponse] = Field(default_factory=list)
    agent_logs: list[AgentLog] = Field(default_factory=list)
    total_duration_seconds: float
    started_at: datetime
    completed_at: Optional[datetime] = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    version: str = "0.1.0"
    codex_available: bool
    gpt_available: bool
    database_connected: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)
