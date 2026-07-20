"""Tests for backend API endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint returns API info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "AutoFix Swarm API"
    assert data["version"] == "0.1.0"
    assert "docs" in data


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "codex_available" in data
    assert "gpt_available" in data
    assert "database_connected" in data


def test_scan_endpoint_placeholder():
    """Test scan endpoint returns placeholder response."""
    response = client.post(
        "/scan",
        json={
            "use_semgrep": True,
            "use_gpt": True,
            "max_issues": 10,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert data["status"] == "succeeded"


def test_fix_endpoint_placeholder():
    """Test fix endpoint returns placeholder response."""
    response = client.post(
        "/fix",
        json={
            "issue_id": "test_issue_001",
            "issue_data": {
                "id": "test_issue_001",
                "file": "test.py",
                "line_range": {"start": 1, "end": 1},
                "description": "test",
                "severity": "medium",
                "confidence": 0.5,
                "detectors": ["test"],
            },
        },
    )
    # Will return 503 if Codex not available, 200 otherwise
    assert response.status_code in [200, 400, 503]


def test_verify_endpoint_placeholder():
    """Test verify endpoint behavior.

    The endpoint now looks up the fix in the database. For a fix_id that
    does not exist it returns 404; for real fix records it runs the
    Reviewer agent. This test only checks the contract surface.
    """
    response = client.post(
        "/verify",
        json={
            "fix_id": "nonexistent_fix_id",
        },
    )
    # 404 when the fix_id is not in the database; 500 if a downstream
    # dependency (e.g. sandbox) is unavailable.
    assert response.status_code in [404, 500]


def test_run_pipeline_placeholder():
    """Test pipeline run endpoint."""
    response = client.post(
        "/run",
        json={
            "repo_path": "seeded_repo",
            "use_semgrep": True,
            "use_gpt": True,
            "auto_fix_threshold": 0.7,
        },
    )
    # May fail if seeded_repo doesn't exist in test environment
    assert response.status_code in [200, 404]


def test_get_latest_results_endpoint():
    """Test getting latest results.

    The endpoint returns 200 if a pipeline run exists in the database,
    or 404 if none exists. We accept either since the global db instance
    may carry state from prior runs or other tests.
    """
    response = client.get("/results/latest")
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        data = response.json()
        assert "run_id" in data
        assert "status" in data


def test_get_results_not_found():
    """Test getting results for non-existent run."""
    response = client.get("/results/nonexistent-run-id")
    assert response.status_code == 404


def test_openapi_docs():
    """Test OpenAPI documentation is available."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_redoc_docs():
    """Test ReDoc documentation is available."""
    response = client.get("/redoc")
    assert response.status_code == 200
