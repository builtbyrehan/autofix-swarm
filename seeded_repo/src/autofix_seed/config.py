"""Configuration loading for the intentionally buggy seed application."""

import json
from pathlib import Path


class ConfigError(RuntimeError):
    """Raised when application configuration cannot be loaded."""


def load_config(path: str | Path) -> dict:
    """Load a JSON configuration file or raise ConfigError."""
    return json.loads(Path(path).read_text(encoding="utf-8"))
