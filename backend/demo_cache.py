"""Demo cache for storing and replaying successful pipeline runs.

This module provides a fallback mechanism: when live APIs (Codex, GPT-5.6)
are unavailable during a demo, the system can replay a previously successful
run's cached output so the demo still works end-to-end.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from backend.config import settings


class DemoCache:
    """Manages cached pipeline runs for demo fallback."""

    def __init__(self, cache_dir: Optional[str] = None) -> None:
        """Initialize demo cache.

        Args:
            cache_dir: Directory for cached runs. Defaults to logs/demo_cache/
        """
        if cache_dir is None:
            self.cache_dir = Path(settings.logs_dir) / "demo_cache"
        else:
            self.cache_dir = Path(cache_dir)

        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.cache_dir / "index.json"
        self._ensure_index()

    def _ensure_index(self) -> None:
        """Create index file if it doesn't exist."""
        if not self.index_path.exists():
            self._write_index({"runs": [], "latest_run_id": None})

    def _read_index(self) -> dict[str, Any]:
        """Read the cache index."""
        try:
            return json.loads(self.index_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"runs": [], "latest_run_id": None}

    def _write_index(self, data: dict[str, Any]) -> None:
        """Write the cache index."""
        self.index_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def save_run(
        self,
        run_id: str,
        pipeline_state: dict[str, Any],
        artifacts_dir: Optional[str] = None,
    ) -> str:
        """Save a successful pipeline run to cache.

        Args:
            run_id: Unique identifier for this run
            pipeline_state: Complete pipeline state (issues, fixes, verdicts)
            artifacts_dir: Optional directory containing fix artifacts

        Returns:
            Path to the cached run directory
        """
        run_dir = self.cache_dir / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        # Save pipeline state
        state_path = run_dir / "pipeline_state.json"
        state_path.write_text(
            json.dumps(pipeline_state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # Copy fix artifacts if they exist
        if artifacts_dir:
            artifacts_src = Path(artifacts_dir)
            if artifacts_src.exists():
                artifacts_dst = run_dir / "artifacts"
                if artifacts_dst.exists():
                    shutil.rmtree(artifacts_dst)
                shutil.copytree(artifacts_src, artifacts_dst)

        # Update index
        index = self._read_index()
        run_entry = {
            "run_id": run_id,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "status": pipeline_state.get("status", "unknown"),
            "issues_found": pipeline_state.get("issues_found", 0),
            "fixes_succeeded": pipeline_state.get("fixes_succeeded", 0),
        }

        # Remove existing entry with same run_id
        index["runs"] = [r for r in index["runs"] if r.get("run_id") != run_id]
        index["runs"].append(run_entry)
        index["latest_run_id"] = run_id

        self._write_index(index)
        return str(run_dir)

    def load_run(self, run_id: str) -> Optional[dict[str, Any]]:
        """Load a cached pipeline run.

        Args:
            run_id: Run identifier to load

        Returns:
            Pipeline state dict, or None if not found
        """
        run_dir = self.cache_dir / run_id
        state_path = run_dir / "pipeline_state.json"

        if not state_path.exists():
            return None

        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def get_latest_run(self) -> Optional[dict[str, Any]]:
        """Get the most recently cached run.

        Returns:
            Pipeline state dict, or None if no runs cached
        """
        index = self._read_index()
        latest_id = index.get("latest_run_id")
        if not latest_id:
            return None
        return self.load_run(latest_id)

    def list_runs(self) -> list[dict[str, Any]]:
        """List all cached runs.

        Returns:
            List of run metadata entries
        """
        index = self._read_index()
        return index.get("runs", [])

    def delete_run(self, run_id: str) -> bool:
        """Delete a cached run.

        Args:
            run_id: Run identifier to delete

        Returns:
            True if deleted, False if not found
        """
        run_dir = self.cache_dir / run_id
        existed = run_dir.exists() or any(
            r.get("run_id") == run_id for r in self._read_index().get("runs", [])
        )

        if run_dir.exists():
            shutil.rmtree(run_dir)

        index = self._read_index()
        index["runs"] = [r for r in index["runs"] if r.get("run_id") != run_id]
        if index.get("latest_run_id") == run_id:
            index["latest_run_id"] = index["runs"][-1]["run_id"] if index["runs"] else None
        self._write_index(index)
        return existed

    def has_cached_run(self) -> bool:
        """Check if any cached runs exist."""
        index = self._read_index()
        return bool(index.get("runs"))

    def get_demo_data(self) -> Optional[dict[str, Any]]:
        """Get demo data for the frontend.

        Returns a formatted dict ready for the dashboard, or None if
        no cached runs exist.
        """
        state = self.get_latest_run()
        if not state:
            return None

        return {
            "run": {
                "run_id": state.get("run_id", "cached"),
                "status": state.get("status", "completed"),
                "issues_found": state.get("issues_found", 0),
                "fixes_attempted": state.get("fixes_attempted", 0),
                "fixes_succeeded": state.get("fixes_succeeded", 0),
                "verifications_passed": state.get("verifications_passed", 0),
                "total_duration_seconds": state.get("total_duration_seconds", 0),
                "is_cached": True,
                "cached_at": state.get("cached_at"),
            },
            "issues": state.get("issues", []),
            "fixes": state.get("fixes", []),
            "verdicts": state.get("verdicts", []),
        }


# Global demo cache instance
demo_cache = DemoCache()
