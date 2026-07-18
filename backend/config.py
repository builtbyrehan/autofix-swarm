"""Configuration management for AutoFix Swarm backend."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # OpenAI API Configuration
    openai_api_key: str = ""
    openai_model: str = "gpt-5.6-luna"  # Default cost-conscious model
    openai_timeout: int = 120  # seconds

    # Codex Configuration
    codex_timeout: int = 120  # seconds
    codex_max_output_bytes: int = 512 * 1024  # 512 KiB

    # Repository paths
    target_repo_path: str = "seeded_repo"
    artifacts_dir: str = "artifacts"
    logs_dir: str = "logs"

    # Database
    database_url: str = "sqlite:///logs/run_log.db"

    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = False  # Hot reload for development

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Rate limiting & safety
    max_issues_per_scan: int = 50
    max_concurrent_fixes: int = 3

    @property
    def target_repo_path_resolved(self) -> Path:
        """Resolve target repository path."""
        return Path(self.target_repo_path).resolve()

    @property
    def artifacts_dir_resolved(self) -> Path:
        """Resolve artifacts directory path."""
        path = Path(self.artifacts_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def logs_dir_resolved(self) -> Path:
        """Resolve logs directory path."""
        path = Path(self.logs_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


# Global settings instance
settings = Settings()
