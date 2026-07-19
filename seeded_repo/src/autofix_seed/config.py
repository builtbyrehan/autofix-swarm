"""Configuration loading for the intentionally buggy seed application."""

import json
from pathlib import Path


class ConfigError(RuntimeError):
    """Raised when application configuration cannot be loaded."""


def load_config(path: str | Path) -> dict:
    """Load a JSON configuration file or raise ConfigError."""
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, PermissionError) as exc:
        raise ConfigError(f"Failed to load config from {path}: {exc}") from exc
