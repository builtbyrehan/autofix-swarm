"""SQLite database layer for logging agent actions."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional

from backend.config import settings
from backend.models import AgentLog, AgentStatus


class Database:
    """SQLite database manager for AutoFix Swarm logs."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file. If None, uses settings.database_url
        """
        if db_path is None:
            # Extract path from database_url (format: sqlite:///path/to/db.db)
            db_url = settings.database_url
            db_path = db_url.replace("sqlite:///", "")

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        """Initialize database schema if not exists."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS pipeline_runs (
                    run_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    repo_path TEXT NOT NULL,
                    config_json TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    total_duration_seconds REAL,
                    issues_found INTEGER DEFAULT 0,
                    fixes_attempted INTEGER DEFAULT 0,
                    fixes_succeeded INTEGER DEFAULT 0,
                    verifications_passed INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS agent_logs (
                    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    agent_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_data TEXT NOT NULL,
                    output_data TEXT NOT NULL,
                    duration_seconds REAL NOT NULL,
                    error_message TEXT DEFAULT '',
                    timestamp TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id)
                );

                CREATE TABLE IF NOT EXISTS issues (
                    issue_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    file TEXT NOT NULL,
                    line_start INTEGER NOT NULL,
                    line_end INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    detectors TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id)
                );

                CREATE TABLE IF NOT EXISTS fixes (
                    fix_id TEXT PRIMARY KEY,
                    issue_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    codex_live INTEGER NOT NULL,
                    summary TEXT NOT NULL,
                    changed_files TEXT NOT NULL,
                    diff_text TEXT,
                    artifact_path TEXT,
                    duration_seconds REAL NOT NULL,
                    failure_reason TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (issue_id) REFERENCES issues(issue_id),
                    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id)
                );

                CREATE TABLE IF NOT EXISTS verdicts (
                    verdict_id TEXT PRIMARY KEY,
                    fix_id TEXT NOT NULL,
                    issue_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    tests_passed INTEGER NOT NULL,
                    explanation TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    duration_seconds REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (fix_id) REFERENCES fixes(fix_id),
                    FOREIGN KEY (issue_id) REFERENCES issues(issue_id),
                    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id)
                );

                CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id ON agent_logs(run_id);
                CREATE INDEX IF NOT EXISTS idx_issues_run_id ON issues(run_id);
                CREATE INDEX IF NOT EXISTS idx_fixes_run_id ON fixes(run_id);
                CREATE INDEX IF NOT EXISTS idx_verdicts_run_id ON verdicts(run_id);
            """)

    def create_pipeline_run(
        self,
        repo_path: str,
        config: dict[str, Any],
    ) -> str:
        """Create a new pipeline run entry.

        Args:
            repo_path: Path to the target repository
            config: Configuration dictionary for this run

        Returns:
            run_id: Unique identifier for this pipeline run
        """
        run_id = str(uuid.uuid4())
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO pipeline_runs
                (run_id, status, repo_path, config_json, started_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    "idle",
                    repo_path,
                    json.dumps(config),
                    datetime.utcnow().isoformat(),
                ),
            )
        return run_id

    def update_pipeline_run(
        self,
        run_id: str,
        status: Optional[str] = None,
        issues_found: Optional[int] = None,
        fixes_attempted: Optional[int] = None,
        fixes_succeeded: Optional[int] = None,
        verifications_passed: Optional[int] = None,
        total_duration_seconds: Optional[float] = None,
    ) -> None:
        """Update pipeline run status and metrics."""
        updates = []
        params = []

        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if issues_found is not None:
            updates.append("issues_found = ?")
            params.append(issues_found)
        if fixes_attempted is not None:
            updates.append("fixes_attempted = ?")
            params.append(fixes_attempted)
        if fixes_succeeded is not None:
            updates.append("fixes_succeeded = ?")
            params.append(fixes_succeeded)
        if verifications_passed is not None:
            updates.append("verifications_passed = ?")
            params.append(verifications_passed)
        if total_duration_seconds is not None:
            updates.append("total_duration_seconds = ?")
            params.append(total_duration_seconds)
            updates.append("completed_at = ?")
            params.append(datetime.utcnow().isoformat())

        if not updates:
            return

        params.append(run_id)
        with self._get_connection() as conn:
            conn.execute(
                f"UPDATE pipeline_runs SET {', '.join(updates)} WHERE run_id = ?",
                params,
            )

    def log_agent_action(
        self,
        run_id: str,
        agent_name: str,
        status: AgentStatus,
        input_data: dict[str, Any],
        output_data: dict[str, Any],
        duration_seconds: float,
        error_message: str = "",
    ) -> int:
        """Log a single agent execution.

        Returns:
            log_id: Integer ID of the created log entry
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO agent_logs
                (run_id, agent_name, status, input_data, output_data,
                 duration_seconds, error_message, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    agent_name,
                    status.value if isinstance(status, AgentStatus) else status,
                    json.dumps(input_data),
                    json.dumps(output_data),
                    duration_seconds,
                    error_message,
                    datetime.utcnow().isoformat(),
                ),
            )
            return cursor.lastrowid

    def save_issue(
        self,
        issue_id: str,
        run_id: str,
        file: str,
        line_start: int,
        line_end: int,
        description: str,
        severity: str,
        confidence: float,
        detectors: list[str],
    ) -> None:
        """Save a Watcher-detected issue."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO issues
                (issue_id, run_id, file, line_start, line_end, description,
                 severity, confidence, detectors, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    issue_id,
                    run_id,
                    file,
                    line_start,
                    line_end,
                    description,
                    severity,
                    confidence,
                    json.dumps(detectors),
                    datetime.utcnow().isoformat(),
                ),
            )

    def save_fix(
        self,
        fix_id: str,
        issue_id: str,
        run_id: str,
        status: str,
        codex_live: bool,
        summary: str,
        changed_files: list[str],
        diff_text: str,
        artifact_path: Optional[str],
        duration_seconds: float,
        failure_reason: str = "",
    ) -> None:
        """Save a Codex fix result."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO fixes
                (fix_id, issue_id, run_id, status, codex_live, summary,
                 changed_files, diff_text, artifact_path, duration_seconds,
                 failure_reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    fix_id,
                    issue_id,
                    run_id,
                    status,
                    1 if codex_live else 0,
                    summary,
                    json.dumps(changed_files),
                    diff_text,
                    artifact_path,
                    duration_seconds,
                    failure_reason,
                    datetime.utcnow().isoformat(),
                ),
            )

    def save_verdict(
        self,
        verdict_id: str,
        fix_id: str,
        issue_id: str,
        run_id: str,
        status: str,
        tests_passed: bool,
        explanation: str,
        confidence: float,
        duration_seconds: float,
    ) -> None:
        """Save a Reviewer verdict."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO verdicts
                (verdict_id, fix_id, issue_id, run_id, status, tests_passed,
                 explanation, confidence, duration_seconds, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    verdict_id,
                    fix_id,
                    issue_id,
                    run_id,
                    status,
                    1 if tests_passed else 0,
                    explanation,
                    confidence,
                    duration_seconds,
                    datetime.utcnow().isoformat(),
                ),
            )

    def get_pipeline_run(self, run_id: str) -> Optional[dict[str, Any]]:
        """Get pipeline run details by ID."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM pipeline_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            return dict(row) if row else None

    def get_latest_pipeline_run(self) -> Optional[dict[str, Any]]:
        """Get the most recent pipeline run."""
        with self._get_connection() as conn:
            row = conn.execute(
                """
                SELECT * FROM pipeline_runs
                ORDER BY started_at DESC
                LIMIT 1
                """
            ).fetchone()
            return dict(row) if row else None

    def get_agent_logs(self, run_id: str) -> list[dict[str, Any]]:
        """Get all agent logs for a pipeline run."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM agent_logs
                WHERE run_id = ?
                ORDER BY timestamp ASC
                """,
                (run_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_issues(self, run_id: str) -> list[dict[str, Any]]:
        """Get all issues for a pipeline run."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM issues
                WHERE run_id = ?
                ORDER BY severity DESC, confidence DESC
                """,
                (run_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_fixes(self, run_id: str) -> list[dict[str, Any]]:
        """Get all fixes for a pipeline run."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM fixes
                WHERE run_id = ?
                ORDER BY created_at ASC
                """,
                (run_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_verdicts(self, run_id: str) -> list[dict[str, Any]]:
        """Get all verdicts for a pipeline run."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM verdicts
                WHERE run_id = ?
                ORDER BY created_at ASC
                """,
                (run_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def health_check(self) -> bool:
        """Check if database connection is healthy."""
        try:
            with self._get_connection() as conn:
                conn.execute("SELECT 1").fetchone()
            return True
        except Exception:
            return False


# Global database instance
db = Database()
