"""Tests for database layer."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from backend.database import Database
from backend.models import AgentStatus


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    db = Database(db_path)
    yield db
    
    # Cleanup
    Path(db_path).unlink(missing_ok=True)


def test_database_initialization(temp_db):
    """Test database schema initialization."""
    assert temp_db.health_check()


def test_create_pipeline_run(temp_db):
    """Test creating a pipeline run."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={"use_semgrep": True, "use_gpt": True},
    )
    
    assert run_id is not None
    run = temp_db.get_pipeline_run(run_id)
    assert run is not None
    assert run["repo_path"] == "/test/repo"
    assert run["status"] == "idle"


def test_update_pipeline_run(temp_db):
    """Test updating pipeline run metrics."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={},
    )
    
    temp_db.update_pipeline_run(
        run_id=run_id,
        status="completed",
        issues_found=5,
        fixes_attempted=3,
        fixes_succeeded=2,
        total_duration_seconds=45.5,
    )
    
    run = temp_db.get_pipeline_run(run_id)
    assert run["status"] == "completed"
    assert run["issues_found"] == 5
    assert run["fixes_attempted"] == 3
    assert run["fixes_succeeded"] == 2
    assert run["total_duration_seconds"] == 45.5


def test_log_agent_action(temp_db):
    """Test logging agent actions."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={},
    )
    
    log_id = temp_db.log_agent_action(
        run_id=run_id,
        agent_name="watcher",
        status=AgentStatus.SUCCEEDED,
        input_data={"repo_path": "/test/repo"},
        output_data={"issues_found": 3},
        duration_seconds=10.5,
    )
    
    assert log_id > 0
    logs = temp_db.get_agent_logs(run_id)
    assert len(logs) == 1
    assert logs[0]["agent_name"] == "watcher"
    assert logs[0]["status"] == "succeeded"


def test_save_and_get_issues(temp_db):
    """Test saving and retrieving issues."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={},
    )
    
    temp_db.save_issue(
        issue_id="bug_001",
        run_id=run_id,
        file="src/main.py",
        line_start=10,
        line_end=15,
        description="SQL injection vulnerability",
        severity="high",
        confidence=0.9,
        detectors=["semgrep", "gpt-5.6"],
    )
    
    issues = temp_db.get_issues(run_id)
    assert len(issues) == 1
    assert issues[0]["issue_id"] == "bug_001"
    assert issues[0]["severity"] == "high"


def test_save_and_get_fixes(temp_db):
    """Test saving and retrieving fixes."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={},
    )
    
    temp_db.save_issue(
        issue_id="bug_001",
        run_id=run_id,
        file="src/main.py",
        line_start=10,
        line_end=15,
        description="Test issue",
        severity="high",
        confidence=0.9,
        detectors=["semgrep"],
    )
    
    temp_db.save_fix(
        fix_id="fix_001",
        issue_id="bug_001",
        run_id=run_id,
        status="succeeded",
        codex_live=True,
        summary="Fixed SQL injection",
        changed_files=["src/main.py"],
        diff_text="@@ -10,5 +10,5 @@...",
        artifact_path="/artifacts/fix_001.diff",
        duration_seconds=30.5,
    )
    
    fixes = temp_db.get_fixes(run_id)
    assert len(fixes) == 1
    assert fixes[0]["fix_id"] == "fix_001"
    assert fixes[0]["codex_live"] == 1


def test_save_and_get_verdicts(temp_db):
    """Test saving and retrieving verdicts."""
    run_id = temp_db.create_pipeline_run(
        repo_path="/test/repo",
        config={},
    )
    
    temp_db.save_issue(
        issue_id="bug_001",
        run_id=run_id,
        file="src/main.py",
        line_start=10,
        line_end=15,
        description="Test issue",
        severity="high",
        confidence=0.9,
        detectors=["semgrep"],
    )
    
    temp_db.save_fix(
        fix_id="fix_001",
        issue_id="bug_001",
        run_id=run_id,
        status="succeeded",
        codex_live=True,
        summary="Fixed issue",
        changed_files=["src/main.py"],
        diff_text="...",
        artifact_path=None,
        duration_seconds=30.0,
    )
    
    temp_db.save_verdict(
        verdict_id="verdict_001",
        fix_id="fix_001",
        issue_id="bug_001",
        run_id=run_id,
        status="succeeded",
        tests_passed=True,
        explanation="All tests passed after applying the fix",
        confidence=0.95,
        duration_seconds=15.5,
    )
    
    verdicts = temp_db.get_verdicts(run_id)
    assert len(verdicts) == 1
    assert verdicts[0]["verdict_id"] == "verdict_001"
    assert verdicts[0]["tests_passed"] == 1


def test_get_latest_pipeline_run(temp_db):
    """Test getting the latest pipeline run."""
    run_id_1 = temp_db.create_pipeline_run(repo_path="/repo1", config={})
    run_id_2 = temp_db.create_pipeline_run(repo_path="/repo2", config={})
    
    latest = temp_db.get_latest_pipeline_run()
    assert latest is not None
    assert latest["run_id"] == run_id_2
