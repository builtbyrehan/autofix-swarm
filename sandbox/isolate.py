"""AutoFix Swarm sandbox — isolated execution for generated code and tests.

This module implements a Docker-based disposable workspace. The Codex Fixer
and the Reviewer use it so that *generated* code and deterministic tests never
touch the original repository, the host filesystem, or the network.

Design boundaries (see ``sandbox/README.md`` and ``important files/rules.md``):

* Generated-code execution and deterministic tests run **offline** inside a
  locked-down container.
* Model/API communication (Codex, GPT-5.6) belongs to a *trusted controller*
  boundary outside this sandbox. The sandbox deliberately makes networking
  impossible for the work it runs; it must not be weakened to host model calls.
* Docker isolation is stronger than a plain ``subprocess`` but this is
  *prototype* isolation, not a claim of production-grade protection against
  every possible container escape.

Only Python's standard library and the Docker CLI are used. No Docker SDK,
no ``shell=True``, no raw shell strings.
"""

from __future__ import annotations

import dataclasses
import fnmatch
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from collections.abc import Iterable, Iterator, Sequence
from difflib import unified_diff
from pathlib import Path
from typing import Any, Final, Optional

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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Default container image. Kept configurable on :class:`SandboxConfig` so the
#: image name is never hardcoded throughout the implementation.
DEFAULT_CONTAINER_IMAGE: Final[str] = "python:3.11-slim"

#: Unprivileged numeric uid/gid used for every container command. Numeric IDs
#: work even when the selected minimal image does not define a named user.
DEFAULT_CONTAINER_USER: Final[str] = "1000:1000"

_NON_ROOT_USER_PATTERN: Final[re.Pattern[str]] = re.compile(r"^[1-9]\d*(?::[0-9]+)?$")

#: Where the temporary repository is mounted inside the container.
WORKSPACE_MOUNT: Final[str] = "/workspace"

#: Prefix used for every disposable container name and temp directory so they
#: can be found and verified-cleaned by tooling (e.g. ``docker ps -a``).
CONTAINER_NAME_PREFIX: Final[str] = "afs-sandbox-"
TEMP_DIR_PREFIX: Final[str] = "afs-sandbox-"

#: Minimum default output cap applied to captured stdout/stderr so malicious or
#: broken code cannot consume unbounded memory.
_DEFAULT_MAX_OUTPUT_BYTES: Final[int] = 1 * 1024 * 1024  # 1 MiB

#: Commands the sandbox is willing to launch *inside* the container for v1.
#: Anything else is rejected by the command validator.
_ALLOWED_COMMANDS: Final[frozenset[str]] = frozenset(
    {
        "python",
        "python3",
        "python3.11",
        "python3.12",
        "python3.13",
        "pytest",
        "git",  # only needed for local diff generation if requested
    }
)

#: Hard stop-list of filenames that must never be copied even if a glob slips.
#: Compared case-insensitively against the basename.
_SECRET_FILENAMES: Final[frozenset[str]] = frozenset(
    {
        ".env",
        "id_rsa",
        "id_ed25519",
        "id_ecdsa",
        "id_dsa",
        ".npmrc",
        ".pypirc",
        ".netrc",
    }
)

#: Files that are explicitly safe to copy (must not contain secret values).
#: Checked against the basename, case-insensitively.
_SAFE_EXAMPLE_FILES: Final[frozenset[str]] = frozenset({".env.example"})


def _default_exclude_patterns() -> tuple[str, ...]:
    """Patterns excluded when copying the target repo into the workspace.

    Mirrors the mandatory exclusion list in the build spec. ``.env.example`` is
    deliberately *not* here — it carries no secret values and is needed for
    documented setup.
    """
    return (
        ".git",
        ".env",
        ".env.*",
        ".venv",
        "venv",
        "env",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        "*.pyc",
        "*.pyo",
        "*.pyd",
        "artifacts",
        "logs",
        # secret / credential material
        "id_rsa",
        "id_rsa_*",
        "id_ed25519",
        "id_ecdsa",
        "id_dsa",
        "*.pem",
        "*.key",
        "*.ppk",
        "credentials",
        "credentials.*",
        "secret*",
        ".aws",
        ".ssh",
    )


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class SandboxError(Exception):
    """Base exception for all sandbox failures."""


class DockerUnavailableError(SandboxError):
    """Raised when Docker cannot be found or contacted.

    The sandbox refuses to silently fall back to an insecure local subprocess
    (build-spec hard rule §16).
    """


class SandboxExecutionError(SandboxError):
    """Infrastructure failure during a sandboxed run.

    Distinct from a command returning a non-zero exit code: a normal command
    failure is reported through :class:`SandboxResult`, whereas an inability to
    create/run/stop the container is raised as this exception.
    """


class CommandValidationError(SandboxError):
    """Raised when a command is not on the allowlist or is malformed."""


class InvalidRepositoryError(SandboxError):
    """Raised when the supplied repository path is missing or not a directory."""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


def _parse_memory_to_bytes(limit: str | int) -> int:
    """Parse a Docker-style memory string (``"512m"``) into bytes."""
    if isinstance(limit, int):
        if limit <= 0:
            raise ValueError("memory_limit must be positive")
        return limit
    text = str(limit).strip().lower()
    if not text:
        raise ValueError("memory_limit must not be empty")
    units = {"k": 1024, "m": 1024**2, "g": 1024**3, "t": 1024**4}
    if text[-1] in units:
        number = float(text[:-1])
        return int(number * units[text[-1]])
    if text[-1] == "b":
        return int(float(text[:-1]))
    return int(float(text))


def _parse_cpu(value: str | int | float) -> float:
    """Parse a CPU limit (``"1.0"``) into a float number of CPUs."""
    n = float(value)
    if n <= 0:
        raise ValueError("cpu_limit must be positive")
    return n


@dataclasses.dataclass(frozen=True)
class SandboxConfig:
    """Configuration for a sandbox session.

    All limits are validated eagerly so misconfiguration fails fast instead of
    producing a permissive container.

    Attributes:
        container_image: OCI image used for the disposable container.
        container_user: Non-root numeric uid, optionally followed by a gid.
        timeout_seconds: Wall-clock limit per command before it is killed.
        memory_limit: Docker ``--memory`` value, e.g. ``"512m"``.
        cpu_limit: Docker ``--cpus`` value, e.g. ``"1.0"``.
        process_limit: Docker ``--pids-limit`` value.
        max_output_bytes: Cap applied to captured stdout/stderr.
        exclude_patterns: Glob patterns excluded when copying the repo.
    """

    container_image: str = DEFAULT_CONTAINER_IMAGE
    container_user: str = DEFAULT_CONTAINER_USER
    timeout_seconds: int = 60
    memory_limit: str = "512m"
    cpu_limit: str = "1.0"
    process_limit: int = 64
    max_output_bytes: int = _DEFAULT_MAX_OUTPUT_BYTES
    exclude_patterns: tuple[str, ...] = dataclasses.field(
        default_factory=_default_exclude_patterns
    )

    def __post_init__(self) -> None:
        # ``object.__setattr__`` because the dataclass is frozen.
        if not isinstance(self.container_image, str) or not self.container_image.strip():
            raise ValueError("container_image must be a non-empty string")
        if ":" not in self.container_image:
            # Reject image names without a tag so the runtime is pinned.
            raise ValueError(
                f"container_image must include an explicit tag: {self.container_image!r}"
            )
        if (
            not isinstance(self.container_user, str)
            or not _NON_ROOT_USER_PATTERN.fullmatch(self.container_user)
        ):
            raise ValueError(
                "container_user must be a non-root numeric uid, optionally followed "
                "by ':gid' (for example '1000:1000')"
            )
        if not isinstance(self.timeout_seconds, int) or self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be a positive integer")
        # Validate memory/cpu by parsing — raises ValueError on bad input.
        _parse_memory_to_bytes(self.memory_limit)
        _parse_cpu(self.cpu_limit)
        if not isinstance(self.process_limit, int) or self.process_limit <= 0:
            raise ValueError("process_limit must be a positive integer")
        if not isinstance(self.max_output_bytes, int) or self.max_output_bytes <= 0:
            raise ValueError("max_output_bytes must be a positive integer")
        if not self.exclude_patterns:
            raise ValueError("exclude_patterns must not be empty")
        # Normalize patterns to a tuple for hashability/immutability.
        patterns = tuple(str(p) for p in self.exclude_patterns)
        object.__setattr__(self, "exclude_patterns", patterns)

    def __repr__(self) -> str:
        # Never include anything that could carry secret material. The config
        # holds no env values, but keep the repr explicit and minimal.
        return (
            "SandboxConfig("
            f"container_image={self.container_image!r}, "
            f"container_user={self.container_user!r}, "
            f"timeout_seconds={self.timeout_seconds}, "
            f"memory_limit={self.memory_limit!r}, "
            f"cpu_limit={self.cpu_limit!r}, "
            f"process_limit={self.process_limit}, "
            f"max_output_bytes={self.max_output_bytes})"
        )


@dataclasses.dataclass(frozen=True)
class SandboxResult:
    """Outcome of a single sandboxed command.

    A non-zero ``exit_code`` represents a *normal command failure* and is **not**
    an exception. Infrastructure failures raise :class:`SandboxExecutionError`
    instead.

    Attributes:
        command: The argument list that was executed.
        exit_code: Process exit code (``-1`` when not available).
        stdout: Captured standard output (truncated to ``max_output_bytes``).
        stderr: Captured standard error (truncated to ``max_output_bytes``).
        duration_seconds: Wall-clock duration of the run.
        timed_out: True if the command exceeded the configured timeout.
        container_id: The container name/identifier used (diagnostic only).
        truncated: True if either stream was truncated.
    """

    command: list[str]
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float
    timed_out: bool
    container_id: str
    truncated: bool = False

    @property
    def returncode(self) -> int:
        """Alias for :attr:`exit_code` matching ``subprocess`` naming."""
        return self.exit_code

    @property
    def success(self) -> bool:
        """True only when the command exited zero and did not time out."""
        return (not self.timed_out) and self.exit_code == 0


# ---------------------------------------------------------------------------
# Helpers: Docker probe, command construction, validation
# ---------------------------------------------------------------------------


def _docker_available() -> bool:
    """Return True if the Docker CLI can contact a running daemon.

    Uses ``docker info`` with a short timeout. We intentionally do not fall
    back to a local subprocess if this returns False.
    """
    try:
        proc = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=15,
            check=False,
        )
        return proc.returncode == 0
    except (FileNotFoundError, subprocess.SubprocessError, OSError):
        return False


def _validate_command(command: Sequence[Any]) -> list[str]:
    """Validate and normalize a user-supplied command into a strict arg array.

    Rejects anything that is not a non-empty list of plain strings, and any
    executable that is not on the allowlist. This is the single chokepoint that
    prevents shell injection / arbitrary binaries.
    """
    if not isinstance(command, (list, tuple)):
        raise CommandValidationError(
            f"command must be a list/tuple of strings, got {type(command).__name__}"
        )
    if len(command) == 0:
        raise CommandValidationError("command must not be empty")
    normalized: list[str] = []
    for part in command:
        if not isinstance(part, str) or part == "":
            raise CommandValidationError(
                "every command argument must be a non-empty string; "
                f"rejecting argument of type {type(part).__name__!r}"
            )
        normalized.append(part)
    executable = os.path.basename(normalized[0])
    if executable not in _ALLOWED_COMMANDS:
        raise CommandValidationError(
            f"executable {normalized[0]!r} (resolved {executable!r}) is not allowed. "
            f"Permitted commands: {sorted(_ALLOWED_COMMANDS)}"
        )
    return normalized


def _matches_any(name: str, patterns: Iterable[str]) -> bool:
    """True if ``name`` matches any glob pattern (case-insensitive)."""
    lower = name.lower()
    return any(fnmatch.fnmatch(lower, p.lower()) for p in patterns)


def _is_secret_filename(name: str) -> bool:
    """True if a basename is on the hard secret-filename stop-list."""
    return name.lower() in {s.lower() for s in _SECRET_FILENAMES}


def _is_safe_example(name: str) -> bool:
    """True for files that must always be allowed through (no secret values)."""
    return name.lower() in {s.lower() for s in _SAFE_EXAMPLE_FILES}


# ---------------------------------------------------------------------------
# Bounded stream capture
# ---------------------------------------------------------------------------


class _BoundedPipe:
    """Reads a process stream into a bounded buffer with safe truncation.

    A malicious or broken program could emit gigabytes; this caps capture at
    ``max_bytes`` and records a trailing marker when truncation occurs.
    """

    _TRUNCATION_MARKER = b"\n...[sandbox: output truncated at size limit]\n"

    def __init__(self, stream: Any, max_bytes: int) -> None:
        self._stream = stream
        self._max_bytes = max_bytes
        self._chunks: list[bytes] = []
        self._size = 0
        self.truncated = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._consume, daemon=True)
        self._thread.start()

    def _consume(self) -> None:
        marker_len = len(self._TRUNCATION_MARKER)
        try:
            while True:
                chunk = self._stream.read(4096)
                if not chunk:
                    break
                remaining = self._max_bytes - self._size
                if remaining <= marker_len:
                    # Reserve room for the marker, then stop capturing.
                    if not self.truncated:
                        self._chunks.append(self._TRUNCATION_MARKER)
                        self._size += marker_len
                        self.truncated = True
                    # Drain the rest to avoid blocking the producer pipe.
                    continue
                take = min(len(chunk), remaining - marker_len)
                if take > 0:
                    self._chunks.append(chunk[:take])
                    self._size += take
                if take < len(chunk) and not self.truncated:
                    self._chunks.append(self._TRUNCATION_MARKER)
                    self._size += marker_len
                    self.truncated = True
        except (OSError, ValueError):
            # Stream closed or unreadable — best effort; stop quietly.
            return

    def join(self, timeout: Optional[float] = None) -> None:
        if self._thread is not None:
            self._thread.join(timeout=timeout)

    def value(self) -> str:
        data = b"".join(self._chunks)
        # Decode best-effort; commands may emit arbitrary bytes.
        return data.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------


class SandboxWorkspace:
    """A disposable, isolated copy of a repository.

    Usage::

        with SandboxWorkspace(repo_path, config=config) as sandbox:
            result = sandbox.run(
                ["python", "-m", "unittest", "discover", "-s", "tests"]
            )
            patch = sandbox.create_diff()

    The original ``repo_path`` is only ever *read*. A unique temporary copy is
    created, mounted into a locked-down container, and removed on exit — even
    after failures or timeouts.
    """

    def __init__(
        self,
        repo_path: str | os.PathLike[str],
        config: Optional[SandboxConfig] = None,
        *,
        auto_start: bool = True,
    ) -> None:
        self.config = config or SandboxConfig()
        if not isinstance(self.config, SandboxConfig):
            raise TypeError("config must be a SandboxConfig instance")

        # Resolve & validate source path before allocating anything.
        raw_source = Path(repo_path)
        try:
            source = raw_source.resolve(strict=True)
        except (FileNotFoundError, RuntimeError, OSError) as exc:
            raise InvalidRepositoryError(
                f"repository path does not exist: {raw_source!r}"
            ) from exc
        if not source.is_dir():
            raise InvalidRepositoryError(
                f"repository path is not a directory: {source!r}"
            )
        # Refuse to sandbox a filesystem root / drive root — too dangerous.
        if source == source.parent:
            raise InvalidRepositoryError(
                f"refusing to sandbox a filesystem root: {source!r}"
            )

        self.source_path: Final[Path] = source
        self.workspace_path: Optional[Path] = None
        self.container_name: Optional[str] = None
        self._closed = False
        self._started = False

        if auto_start:
            self._start()

    # -- lifecycle ----------------------------------------------------------

    def _start(self) -> None:
        if self._started:
            return
        if not _docker_available():
            raise DockerUnavailableError(
                "Docker is not available. The sandbox will not fall back to an "
                "insecure local subprocess — start Docker Desktop and retry."
            )
        # Unique temp directory per session.
        run_id = uuid.uuid4().hex[:12]
        temp_root = Path(tempfile.mkdtemp(prefix=TEMP_DIR_PREFIX))
        self.workspace_path = temp_root / f"workspace-{run_id}"
        self.workspace_path.mkdir(parents=True, exist_ok=False)
        self.container_name = f"{CONTAINER_NAME_PREFIX}{run_id}"
        self._copy_repo_into_workspace()
        self._started = True

    def __enter__(self) -> "SandboxWorkspace":
        if not self._started:
            self._start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
        return None

    def close(self) -> None:
        """Remove the container (if any) and the temporary directory.

        Idempotent: safe to call multiple times, and safe after a timeout or
        exception. Never raises — cleanup failures are swallowed so an
        infrastructure problem can't mask the real error.
        """
        if self._closed:
            return
        self._closed = True
        # Best-effort container stop/rm. Named uniquely so this is safe even
        # if a previous run timed out.
        name = self.container_name
        if name:
            for args in (["docker", "stop", name], ["docker", "rm", "-f", name]):
                try:
                    subprocess.run(
                        args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=30,
                        check=False,
                    )
                except (subprocess.SubprocessError, OSError):
                    continue
        # Remove the temporary directory entirely.
        if self.workspace_path is not None:
            shutil.rmtree(self.workspace_path, ignore_errors=True)
            # Also try to remove the temp root if it's now empty.
            parent = self.workspace_path.parent
            try:
                parent.rmdir()
            except OSError:
                pass

    # -- repository copying -------------------------------------------------

    def _copy_repo_into_workspace(self) -> None:
        assert self.workspace_path is not None
        root = self.source_path
        dest = self.workspace_path
        for src_path in _walk_repo(root, self.config.exclude_patterns):
            rel = src_path.relative_to(root)
            name = src_path.name
            # ``.env.example`` carries no secret values and is required for
            # documented setup, so allow it through even though it matches the
            # ``.env.*`` exclude pattern.
            if _is_safe_example(name):
                pass
            elif _path_is_excluded(rel, self.config.exclude_patterns):
                continue
            elif _is_secret_filename(name):
                # Hard stop-list: never copy known secret files even if a glob
                # would otherwise include them.
                continue
            dst_path = dest / rel
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            # Copy by content, not by symlink, so escaping links can't be
            # smuggled through as link metadata. ``copyfile`` follows symlinks
            # that were already validated as in-repo by ``_walk_repo``.
            if src_path.is_dir():
                dst_path.mkdir(exist_ok=True)
                continue
            shutil.copyfile(src_path, dst_path)

    # -- diff ---------------------------------------------------------------

    def create_diff(self) -> str:
        """Return a deterministic unified diff of source vs. workspace.

        Computed host-side so the original repository is only ever read. Files
        that only exist in the workspace (newly created by generated code) and
        files that only exist in the source are both represented.
        """
        if self.workspace_path is None:
            raise SandboxError("workspace is not initialized")
        source_files = _relative_file_set(self.source_path, self.config.exclude_patterns)
        workspace_files = _relative_file_set(self.workspace_path, self.config.exclude_patterns)
        all_rel = sorted(source_files | workspace_files)
        diff_chunks: list[str] = []
        for rel in all_rel:
            in_source = rel in source_files
            in_workspace = rel in workspace_files
            src_file = self.source_path / rel
            dst_file = self.workspace_path / rel
            try:
                src_lines = (
                    src_file.read_text(encoding="utf-8", errors="replace").splitlines(
                        keepends=False
                    )
                    if in_source
                    else []
                )
            except OSError:
                src_lines = []
            try:
                dst_lines = (
                    dst_file.read_text(encoding="utf-8", errors="replace").splitlines(
                        keepends=False
                    )
                    if in_workspace
                    else []
                )
            except OSError:
                dst_lines = []
            if src_lines == dst_lines:
                continue
            diff = unified_diff(
                src_lines,
                dst_lines,
                fromfile=f"a/{rel.as_posix()}",
                tofile=f"b/{rel.as_posix()}",
                lineterm="",
            )
            diff_text = "\n".join(diff)
            if diff_text:
                diff_chunks.append(diff_text)
        return "\n".join(diff_chunks)

    # -- command execution --------------------------------------------------

    def run(self, command: Sequence[Any]) -> SandboxResult:
        """Run ``command`` inside the isolated container.

        Returns a :class:`SandboxResult` for both success and normal command
        failures. Raises :class:`CommandValidationError` for disallowed
        commands and :class:`SandboxExecutionError` for infrastructure
        failures.
        """
        if self._closed:
            raise SandboxError("sandbox has been closed")
        if not self._started or self.workspace_path is None or self.container_name is None:
            raise SandboxError("sandbox workspace is not initialized")
        argv = _validate_command(command)
        docker_argv = self._build_run_argv(argv)
        start = time.monotonic()
        timed_out = False

        try:
            proc = subprocess.Popen(
                docker_argv,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
            )
        except FileNotFoundError as exc:
            raise DockerUnavailableError("docker executable not found") from exc
        except OSError as exc:
            raise SandboxExecutionError(f"failed to start docker: {exc}") from exc

        out_pipe = _BoundedPipe(proc.stdout, self.config.max_output_bytes)
        err_pipe = _BoundedPipe(proc.stderr, self.config.max_output_bytes)
        out_pipe.start()
        err_pipe.start()

        try:
            exit_code = proc.wait(timeout=self.config.timeout_seconds)
        except subprocess.TimeoutExpired:
            timed_out = True
            # 1. Terminate the docker client process.
            self._terminate_client(proc)
            # 2. Stop/remove the uniquely named container so nothing lingers.
            self._force_remove_container(self.container_name)
            exit_code = proc.returncode if proc.returncode is not None else -1

        out_pipe.join(timeout=10)
        err_pipe.join(timeout=10)
        duration = time.monotonic() - start

        if timed_out:
            stderr_tail = err_pipe.value()
            stderr_text = (
                stderr_tail
                + f"\n[sandbox: command exceeded {self.config.timeout_seconds}s timeout "
                "and was terminated]"
            )
        else:
            stderr_text = err_pipe.value()

        return SandboxResult(
            command=argv,
            exit_code=exit_code,
            stdout=out_pipe.value(),
            stderr=stderr_text,
            duration_seconds=duration,
            timed_out=timed_out,
            container_id=self.container_name,
            truncated=out_pipe.truncated or err_pipe.truncated,
        )

    def _build_run_argv(self, command_argv: list[str]) -> list[str]:
        """Construct the ``docker run`` argument array for ``command_argv``.

        Pure function over the validated command — kept separate so it can be
        unit-tested without contacting Docker.
        """
        assert self.workspace_path is not None and self.container_name is not None
        cfg = self.config
        mount = f"{self.workspace_path}:{WORKSPACE_MOUNT}"
        return [
            "docker",
            "run",
            "--rm",
            "--name", self.container_name,
            "--network", "none",
            "--read-only",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges",
            "--user", cfg.container_user,
            "--pids-limit", str(cfg.process_limit),
            "--memory", str(cfg.memory_limit),
            "--cpus", str(cfg.cpu_limit),
            # ``/tmp`` is the only writable scratch the container needs beyond
            # the bind-mounted ``/workspace``. Capped so it cannot fill memory.
            "--tmpfs", "/tmp:rw,nosuid,size=64m,mode=1777",
            # ``--init`` reaps zombies so fork-heavy code can't wedge the pid
            # limit into a hang.
            "--init",
            "-v", mount,
            "-w", WORKSPACE_MOUNT,
            cfg.container_image,
            *command_argv,
        ]

    # -- timeout handling helpers ------------------------------------------

    def _terminate_client(self, proc: subprocess.Popen[Any]) -> None:
        """Terminate the ``docker run`` client process on timeout."""
        for _ in range(3):
            if proc.poll() is not None:
                return
            try:
                proc.terminate()
            except OSError:
                return
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                continue
        if proc.poll() is None:
            try:
                proc.kill()
            except OSError:
                pass

    def _force_remove_container(self, name: str) -> None:
        """Best-effort ``docker stop`` + ``docker rm -f`` for a named container."""
        for args in (["docker", "stop", name], ["docker", "rm", "-f", name]):
            try:
                subprocess.run(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=30,
                    check=False,
                )
            except (subprocess.SubprocessError, OSError):
                continue


# ---------------------------------------------------------------------------
# Repository walking / exclusion (module-level, testable)
# ---------------------------------------------------------------------------


def _walk_repo(root: Path, patterns: Iterable[str]) -> Iterator[Path]:
    """Yield every file/dir under ``root``.

    Symlinks are dereferenced here so escaping links can be detected against
    the resolved target. A symlink whose target leaves ``root`` is rejected
    by the caller's copy logic (see :func:`_link_escapes`). Excluded
    directories are pruned in place so their contents are never walked.
    """
    pat_tuple = tuple(patterns)
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        current = Path(dirpath)
        # Yield the directory itself (so empty dirs are preserved), unless it
        # is itself excluded (e.g. the walk somehow re-entered one).
        if not _path_is_excluded(current.relative_to(root), pat_tuple):
            yield current
        # Filter subdirectories in place: drop excluded + escaping-symlink dirs.
        kept: list[str] = []
        for d in list(dirnames):
            sub = current / d
            rel_sub = sub.relative_to(root)
            if _path_is_excluded(rel_sub, pat_tuple):
                continue
            if sub.is_symlink():
                target = _resolve_symlink(sub)
                if target is None:
                    # Could not resolve — drop it defensively.
                    continue
                if _link_escapes(target, root):
                    raise SandboxError(
                        f"refusing to copy symlink that escapes the repository: {sub}"
                    )
            kept.append(d)
        dirnames[:] = kept
        for f in filenames:
            fp = current / f
            if fp.is_symlink():
                target = _resolve_symlink(fp)
                if target is None:
                    continue
                if _link_escapes(target, root):
                    raise SandboxError(
                        f"refusing to copy symlink that escapes the repository: {fp}"
                    )
            yield fp


def _resolve_symlink(path: Path) -> Optional[Path]:
    """Resolve a symlink to its target, or None if it cannot be resolved."""
    try:
        return path.resolve(strict=False)
    except (OSError, RuntimeError):
        return None


def _link_escapes(target: Path, root: Path) -> bool:
    """True if ``target`` is not inside ``root``."""
    try:
        target.relative_to(root)
        return False
    except ValueError:
        return True


def _path_is_excluded(rel: Path, patterns: Iterable[str]) -> bool:
    """True if any component of ``rel`` matches an exclude pattern."""
    parts = rel.parts
    if not parts:
        return False
    for part in parts:
        if _matches_any(part, patterns):
            return True
    return False


def _relative_file_set(root: Path, patterns: Iterable[str]) -> set[Path]:
    """Return the set of relative file paths under ``root`` (excluding patterns)."""
    files: set[Path] = set()
    if not root.exists():
        return files
    for dirpath, _dirnames, filenames in os.walk(root):
        current = Path(dirpath)
        for f in filenames:
            fp = current / f
            rel = fp.relative_to(root)
            if _path_is_excluded(rel, patterns):
                continue
            files.add(rel)
    return files
