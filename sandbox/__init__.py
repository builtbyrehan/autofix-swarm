"""AutoFix Swarm sandbox subsystem.

Public surface for the Codex Fixer and Reviewer to run generated code and
deterministic tests inside a locked-down, offline, disposable Docker workspace.

See :mod:`sandbox.isolate` for the full implementation and ``sandbox/README.md``
for the guarantees, limitations, and how the Fixer/Reviewer use this module.
"""

from sandbox.isolate import (
    DEFAULT_CONTAINER_IMAGE,
    DEFAULT_CONTAINER_USER,
    CommandValidationError,
    DockerUnavailableError,
    InvalidRepositoryError,
    SandboxConfig,
    SandboxError,
    SandboxExecutionError,
    SandboxResult,
    SandboxWorkspace,
)

__all__ = [
    "SandboxConfig",
    "SandboxResult",
    "SandboxWorkspace",
    "SandboxError",
    "DockerUnavailableError",
    "SandboxExecutionError",
    "CommandValidationError",
    "InvalidRepositoryError",
    "DEFAULT_CONTAINER_IMAGE",
    "DEFAULT_CONTAINER_USER",
]
