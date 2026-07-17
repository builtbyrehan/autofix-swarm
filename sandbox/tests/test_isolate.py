"""Tests for the AutoFix Swarm sandbox.

Split into two layers:

* **Unit tests** (``TestSandbox*`` classes) — never touch Docker or the network.
  They validate configuration, repository copying, exclusions, symlink safety,
  command policy, output bounding, cleanup, diffing, and Docker command
  construction.
* **Integration tests** (``@pytest.mark.integration``) — require a working
  Docker daemon. They are skipped automatically with a clear reason when
  Docker is unavailable, but per the build spec they must pass on a machine
  where Docker Desktop works before the work is declared complete.

Per build-spec §9, networking-isolation proofs use a short Python socket/DNS
attempt — never a live external website — whose expected result under
``--network none`` is failure.
"""

from __future__ import annotations

import os
import socket
import subprocess
import textwrap
import time
from pathlib import Path

import pytest

from sandbox import isolate
from sandbox.isolate import (
    CommandValidationError,
    DockerUnavailableError,
    InvalidRepositoryError,
    SandboxConfig,
    SandboxError,
    SandboxExecutionError,
    SandboxResult,
    SandboxWorkspace,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
SEEDED_REPO = REPO_ROOT / "seeded_repo"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_repo(path: Path) -> Path:
    """Create a tiny fake repository layout under ``path`` and return it."""
    path.mkdir(parents=True, exist_ok=True)
    (path / "src").mkdir(exist_ok=True)
    (path / "src" / "app.py").write_text("VALUE = 1\n", encoding="utf-8")
    (path / "README.md").write_text("# demo\n", encoding="utf-8")
    (path / "tests").mkdir(exist_ok=True)
    (path / "tests" / "test_app.py").write_text(
        textwrap.dedent(
            """
            import unittest
            class T(unittest.TestCase):
                def test_ok(self):
                    self.assertTrue(True)
            """
        ).strip()
        + "\n",
        encoding="utf-8",
    )
    return path


@pytest.fixture
def fake_repo(tmp_path: Path) -> Path:
    return _make_repo(tmp_path / "repo")


@pytest.fixture
def seeded_repo() -> Path:
    """The real target repository the demo runs against."""
    if not SEEDED_REPO.is_dir():
        pytest.skip(f"seeded repo not found at {SEEDED_REPO}")
    return SEEDED_REPO


def docker_is_available() -> bool:
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


DOCKER_AVAILABLE = docker_is_available()
skip_if_no_docker = pytest.mark.skipif(
    not DOCKER_AVAILABLE,
    reason="Docker daemon is not available; start Docker Desktop to run integration tests",
)
integration = pytest.mark.integration


# ===========================================================================
# UNIT TESTS  (no Docker, no network)
# ===========================================================================


class TestSourcePathValidation:
    """1. Source-path validation."""

    def test_missing_path_raises(self) -> None:
        with pytest.raises(InvalidRepositoryError):
            SandboxWorkspace(Path("definitely/does/not/exist/xyz"), auto_start=False)._start()  # noqa: SLF001

    def test_file_not_directory_raises(self, tmp_path: Path) -> None:
        f = tmp_path / "file.txt"
        f.write_text("x")
        with pytest.raises(InvalidRepositoryError):
            SandboxWorkspace(f)

    def test_filesystem_root_rejected(self) -> None:
        # A drive/filesystem root must never be sandboxed wholesale.
        with pytest.raises(InvalidRepositoryError):
            SandboxWorkspace(Path(os.sep).resolve())


class TestConfigValidation:
    """2. Configuration validation."""

    def test_default_config_is_valid(self) -> None:
        c = SandboxConfig()
        assert c.container_image == "python:3.11-slim"
        assert c.timeout_seconds > 0
        assert c.process_limit > 0

    def test_image_requires_tag(self) -> None:
        with pytest.raises(ValueError):
            SandboxConfig(container_image="python")

    def test_bad_memory_raises(self) -> None:
        with pytest.raises(ValueError):
            SandboxConfig(memory_limit="")

    def test_nonpositive_limits_rejected(self) -> None:
        with pytest.raises(ValueError):
            SandboxConfig(timeout_seconds=0)
        with pytest.raises(ValueError):
            SandboxConfig(process_limit=-1)
        with pytest.raises(ValueError):
            SandboxConfig(max_output_bytes=0)

    def test_exclude_patterns_default_present(self) -> None:
        c = SandboxConfig()
        # The mandatory minimum exclusion set must be present.
        for required in (".git", ".env", "node_modules", "__pycache__", "*.pyc"):
            assert required in c.exclude_patterns


class TestTemporaryWorkspaceCreation:
    """3. Temporary workspace creation (without launching Docker)."""

    def test_temp_path_is_unique_and_under_tempdir(self, fake_repo: Path, monkeypatch) -> None:
        # Avoid requiring Docker: drive the copy logic directly.
        ws = SandboxWorkspace.__new__(SandboxWorkspace)  # bypass __init__
        ws.config = SandboxConfig()
        ws.source_path = fake_repo
        ws.workspace_path = None
        ws.container_name = None
        ws._closed = False  # noqa: SLF001
        ws._started = False  # noqa: SLF001
        # Monkeypatch docker availability so _start proceeds past the probe.
        monkeypatch.setattr(isolate, "_docker_available", lambda: True)
        # _start() only allocates a temp dir and copies the repo; no container
        # is created until run(), so this is safe without Docker.
        ws._start()  # noqa: SLF001
        try:
            assert ws.workspace_path is not None
            assert ws.workspace_path.exists()
            assert ws.container_name is not None
            assert ws.container_name.startswith("afs-sandbox-")
        finally:
            ws.close()  # noqa: SLF001


class TestSensitiveFileExclusions:
    """4. Sensitive-file exclusions."""

    def test_secrets_excluded_from_copy(self, fake_repo: Path, monkeypatch) -> None:
        # Drop a pile of sensitive material into the repo.
        (fake_repo / ".env").write_text("OPENAI_API_KEY=sk-secret\n")
        (fake_repo / ".env.local").write_text("OPENAI_API_KEY=sk-secret\n")
        (fake_repo / "id_rsa").write_text("PRIVATE KEY MATERIAL\n")
        (fake_repo / "server.pem").write_text("CERT\n")
        (fake_repo / "private.key").write_text("KEY\n")
        (fake_repo / ".env.example").write_text("OPENAI_API_KEY=\nOPENAI_MODEL=gpt-5.6-luna\n")
        secret_sub = fake_repo / "nested" / "deep"
        secret_sub.mkdir(parents=True)
        (secret_sub / "credentials.json").write_text("{}")
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        try:
            assert not (ws.workspace_path / ".env").exists()
            assert not (ws.workspace_path / ".env.local").exists()
            assert not (ws.workspace_path / "id_rsa").exists()
            assert not (ws.workspace_path / "server.pem").exists()
            assert not (ws.workspace_path / "private.key").exists()
            assert not (ws.workspace_path / "nested" / "deep" / "credentials.json").exists()
            # .env.example is explicitly safe and must be copied.
            assert (ws.workspace_path / ".env.example").read_text().strip() != ""
        finally:
            ws.close()  # noqa: SLF001

    def test_dotgit_and_caches_excluded(self, fake_repo: Path, monkeypatch) -> None:
        (fake_repo / ".git").mkdir()
        (fake_repo / ".git" / "config").write_text("x")
        (fake_repo / "__pycache__").mkdir()
        (fake_repo / "__pycache__" / "x.pyc").write_text("x")
        (fake_repo / "node_modules").mkdir()
        (fake_repo / "node_modules" / "pkg").write_text("x")
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        try:
            assert not (ws.workspace_path / ".git").exists()
            assert not (ws.workspace_path / "__pycache__").exists()
            assert not (ws.workspace_path / "node_modules").exists()
        finally:
            ws.close()  # noqa: SLF001


class TestInternalFileCopying:
    """5. Internal file copying."""

    def test_regular_files_copied_with_content(self, fake_repo: Path, monkeypatch) -> None:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        try:
            copied = (ws.workspace_path / "src" / "app.py").read_text()
            assert copied == "VALUE = 1\n"
            assert (ws.workspace_path / "README.md").exists()
            assert (ws.workspace_path / "tests" / "test_app.py").exists()
        finally:
            ws.close()  # noqa: SLF001


def _can_create_symlinks(tmp_path: Path) -> bool:
    """Return True if the current process may create symlinks on this OS.

    Non-admin Windows without Developer Mode denies symlink creation
    (WinError 1314); on such hosts we skip symlink tests rather than report a
    false failure — the rejection logic itself is OS-independent.
    """
    probe = tmp_path / "_symlink_probe_target"
    link = tmp_path / "_symlink_probe_link"
    try:
        probe.write_text("x")
        link.symlink_to(probe)
        link.unlink()
        probe.unlink()
        return True
    except (OSError, NotImplementedError):
        return False


def _skip_without_symlinks(tmp_path: Path) -> None:
    if not _can_create_symlinks(tmp_path):
        pytest.skip("symlinks cannot be created in this environment (non-admin Windows)")


class TestSymlinkEscapeRejection:
    """6. Escaping symbolic-link rejection."""

    def test_symlink_escaping_repo_raises(self, fake_repo: Path, tmp_path: Path, monkeypatch) -> None:
        _skip_without_symlinks(tmp_path)
        outside = tmp_path / "outside"
        outside.mkdir()
        (outside / "secret.txt").write_text("STOLEN")
        # In-repo symlink that points outside the repo.
        (fake_repo / "escape").symlink_to(outside)
        _workspace_without_docker(fake_repo, monkeypatch, expect_raise=True)
        # The helper asserts that SandboxError is raised.

    def test_in_repo_symlink_is_allowed(self, fake_repo: Path, tmp_path: Path, monkeypatch) -> None:
        _skip_without_symlinks(tmp_path)
        # Symlink whose target is inside the repo must not be rejected.
        target = fake_repo / "src" / "app.py"
        (fake_repo / "src" / "link_to_app.py").symlink_to(target)
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        try:
            # The link's target content is copied as a regular file.
            assert (ws.workspace_path / "src" / "link_to_app.py").exists()
        finally:
            ws.close()  # noqa: SLF001


class TestCommandAllowlist:
    """7. Command allowlist enforcement."""

    @pytest.mark.parametrize("cmd", [["rm", "-rf", "/"], ["bash", "-c", "x"], ["sh"], ["curl", "x"]])
    def test_disallowed_executable_rejected(self, cmd: list[str]) -> None:
        with pytest.raises(CommandValidationError):
            isolate._validate_command(cmd)  # noqa: SLF001

    def test_allowed_executable_accepted(self) -> None:
        normalized = isolate._validate_command(["python", "-c", "print(1)"])  # noqa: SLF001
        assert normalized == ["python", "-c", "print(1)"]


class TestArgumentArrayValidation:
    """8. Argument-array validation."""

    @pytest.mark.parametrize(
        "cmd",
        [
            [],
            "python -c 'print(1)'",  # a raw string, not a list
            None,
            ["python", "-c", 123],  # non-string element
            ["python", ""],  # empty-string element
            ["", "-c"],  # empty executable
        ],
    )
    def test_malformed_commands_rejected(self, cmd: object) -> None:
        with pytest.raises(CommandValidationError):
            isolate._validate_command(cmd)  # noqa: SLF001


class TestOutputTruncation:
    """9. Output truncation."""

    def test_bounded_pipe_truncates(self) -> None:
        import io

        payload = b"A" * 5000
        stream = io.BufferedReader(io.BytesIO(payload))  # type: ignore[arg-type]
        pipe = isolate._BoundedPipe(stream, max_bytes=100)  # noqa: SLF001
        pipe.start()
        pipe.join(timeout=5)
        value = pipe.value()
        assert pipe.truncated
        assert len(value.encode("utf-8", errors="replace")) <= 100 + len(pipe._TRUNCATION_MARKER)  # noqa: SLF001
        assert "truncated" in value

    def test_bounded_pipe_no_truncation_under_limit(self) -> None:
        import io

        payload = b"hello\n"
        stream = io.BufferedReader(io.BytesIO(payload))  # type: ignore[arg-type]
        pipe = isolate._BoundedPipe(stream, max_bytes=1024)  # noqa: SLF001
        pipe.start()
        pipe.join(timeout=5)
        assert not pipe.truncated
        assert pipe.value() == "hello\n"


class TestCleanup:
    """10 & 11. Cleanup after success and after exceptions."""

    def test_cleanup_after_success(self, fake_repo: Path, monkeypatch) -> None:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        path = ws.workspace_path
        assert path is not None and path.exists()
        ws.close()  # noqa: SLF001
        assert not path.exists()
        # Idempotent: a second close is a no-op.
        ws.close()  # noqa: SLF001

    def test_cleanup_after_exception(self, fake_repo: Path, monkeypatch) -> None:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        path = ws.workspace_path
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            ws.close()  # noqa: SLF001
        assert path is not None
        assert not path.exists()

    def test_context_manager_cleans_up(self, fake_repo: Path, monkeypatch) -> None:
        monkeypatch.setattr(isolate, "_docker_available", lambda: True)
        ws = SandboxWorkspace(fake_repo)
        path = ws.workspace_path
        with ws:
            assert path is not None and path.exists()
        assert path is not None and not path.exists()


class TestDiffGeneration:
    """12. Diff generation."""

    def test_diff_detects_modified_file(self, fake_repo: Path, monkeypatch) -> None:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        # Mutate the *workspace* copy only.
        (ws.workspace_path / "src" / "app.py").write_text("VALUE = 2\n")
        diff = ws.create_diff()
        assert "src/app.py" in diff
        assert "-VALUE = 1" in diff
        assert "+VALUE = 2" in diff
        ws.close()  # noqa: SLF001

    def test_no_changes_yields_empty_diff(self, fake_repo: Path, monkeypatch) -> None:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        assert ws.create_diff() == ""
        ws.close()  # noqa: SLF001


class TestOriginalRepoUnchanged:
    """13. Original repository remaining unchanged."""

    def test_source_not_modified_by_copy_or_diff(self, fake_repo: Path, monkeypatch) -> None:
        original = (fake_repo / "src" / "app.py").read_bytes()
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        (ws.workspace_path / "src" / "app.py").write_text("VALUE = 999\n")
        _ = ws.create_diff()
        ws.close()  # noqa: SLF001
        assert (fake_repo / "src" / "app.py").read_bytes() == original


class TestDockerCommandConstruction:
    """14. Docker command construction."""

    def _make_ws(self, fake_repo: Path, monkeypatch) -> SandboxWorkspace:
        ws = _workspace_without_docker(fake_repo, monkeypatch)
        return ws

    def test_run_argv_has_safety_flags(self, fake_repo: Path, monkeypatch) -> None:
        ws = self._make_ws(fake_repo, monkeypatch)
        try:
            argv = ws._build_run_argv(["python", "-V"])  # noqa: SLF001
            # Must contain the full hardening set.
            joined = " ".join(argv)
            for flag in (
                "--network none",
                "--read-only",
                "--cap-drop ALL",
                "--security-opt no-new-privileges",
                "--pids-limit",
                "--memory",
                "--cpus",
                "--tmpfs /tmp",
                "--init",
                "--rm",
            ):
                assert flag in joined, f"missing flag {flag!r} in {joined}"
            # Mount must be the unique temp workspace -> /workspace, read-default.
            assert any(a.endswith(":/workspace") for a in argv), argv
            assert "-w" in argv and "/workspace" in argv
            # The command runs as an argv array, not a shell string.
            assert argv[-2:] == ["python", "-V"]
        finally:
            ws.close()  # noqa: SLF001

    def test_no_privileged_and_no_shell(self, fake_repo: Path, monkeypatch) -> None:
        ws = self._make_ws(fake_repo, monkeypatch)
        try:
            argv = ws._build_run_argv(["python", "-c", "print(1)"])  # noqa: SLF001
            assert "--privileged" not in argv
            assert "-t" not in argv and "--tty" not in argv
            # No shell invocation as the entrypoint.
            assert "bash" not in argv and "sh" not in argv and "/bin/sh" not in argv
        finally:
            ws.close()  # noqa: SLF001

    def test_container_name_unique_and_namespaced(self, fake_repo: Path, monkeypatch) -> None:
        ws1 = _workspace_without_docker(fake_repo, monkeypatch)
        ws2 = _workspace_without_docker(fake_repo, monkeypatch)
        try:
            assert ws1.container_name != ws2.container_name
            assert ws1.container_name.startswith("afs-sandbox-")
            assert ws2.container_name.startswith("afs-sandbox-")
        finally:
            ws1.close()  # noqa: SLF001
            ws2.close()  # noqa: SLF001


class TestDockerUnavailable:
    """15. Docker-unavailable error behavior."""

    def test_raises_when_docker_missing(self, fake_repo: Path, monkeypatch) -> None:
        monkeypatch.setattr(isolate, "_docker_available", lambda: False)
        with pytest.raises(DockerUnavailableError):
            SandboxWorkspace(fake_repo)

    def test_no_fallback_subprocess(self, fake_repo: Path, monkeypatch) -> None:
        # Even if Docker is unavailable, the workspace must not be constructed
        # into a usable (insecure) state.
        monkeypatch.setattr(isolate, "_docker_available", lambda: False)
        with pytest.raises(DockerUnavailableError):
            SandboxWorkspace(fake_repo)


# ---------------------------------------------------------------------------
# Helper used by several unit tests: build a workspace copy without Docker.
# ---------------------------------------------------------------------------


def _workspace_without_docker(
    repo: Path, monkeypatch, *, expect_raise: bool = False
) -> SandboxWorkspace:
    """Construct a SandboxWorkspace and let it copy the repo, faking Docker up.

    If ``expect_raise`` is True, assert that construction raises SandboxError
    (used by the escaping-symlink test) and return None.
    """
    monkeypatch.setattr(isolate, "_docker_available", lambda: True)
    if expect_raise:
        with pytest.raises(SandboxError):
            SandboxWorkspace(repo)
        return None  # type: ignore[return-value]
    return SandboxWorkspace(repo)


# ===========================================================================
# DOCKER INTEGRATION TESTS  (require docker daemon; skipped otherwise)
# ===========================================================================


@skip_if_no_docker
@integration
class TestDockerFilesystemIsolation:
    """Integration: filesystem isolation guarantees."""

    def test_python_can_read_file_in_workspace(self, seeded_repo: Path) -> None:
        with SandboxWorkspace(seeded_repo) as ws:
            result = ws.run(
                ["python", "-c", "import pathlib;print(pathlib.Path('/workspace/README.md').read_text()[:5])"]
            )
            assert result.success, result.stderr

    def test_python_can_write_inside_workspace(self, fake_repo: Path) -> None:
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(
                ["python", "-c", "open('/workspace/out.txt','w').write('ok')"]
            )
            assert result.success, result.stderr
            assert (ws.workspace_path / "out.txt").read_text() == "ok"

    def test_original_repo_unchanged_after_container_write(self, fake_repo: Path) -> None:
        before = (fake_repo / "src" / "app.py").read_bytes()
        with SandboxWorkspace(fake_repo) as ws:
            r = ws.run(["python", "-c", "open('/workspace/src/app.py','w').write('mutated')"])
            assert r.success, r.stderr
        after = (fake_repo / "src" / "app.py").read_bytes()
        assert before == after

    def test_write_outside_workspace_fails(self, fake_repo: Path) -> None:
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(["python", "-c", "open('/escape.txt','w').write('x')"])
            assert not result.success
            # And the host path must not have been created.
            assert not Path("/escape.txt").exists()

    def test_dotdot_escape_fails(self, fake_repo: Path) -> None:
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(
                ["python", "-c", "open('/workspace/../escape2.txt','w').write('x')"]
            )
            assert not result.success

    def test_root_filesystem_read_only(self, fake_repo: Path) -> None:
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(["python", "-c", "open('/readonly.txt','w').write('x')"])
            assert not result.success
            assert "Read-only" in result.stderr or "read-only" in result.stderr


@skip_if_no_docker
@integration
class TestDockerNetworkIsolation:
    """Integration: networking is fully disabled (--network none)."""

    def test_tcp_socket_to_public_ip_fails(self, fake_repo: Path) -> None:
        # Short socket attempt; no live external website.
        prog = (
            "import socket; "
            "s=socket.socket(); s.settimeout(3); "
            "s.connect(('1.1.1.1',80)); print('CONNECTED')"
        )
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(["python", "-c", prog])
            assert not result.success
            assert "CONNECTED" not in result.stdout

    def test_dns_resolution_fails(self, fake_repo: Path) -> None:
        prog = (
            "import socket; print(socket.gethostbyname('example.com'))"
        )
        with SandboxWorkspace(fake_repo) as ws:
            result = ws.run(["python", "-c", prog])
            assert not result.success
            assert "example.com" in result.stderr or result.exit_code != 0


@skip_if_no_docker
@integration
class TestDockerResourceLimits:
    """Integration: process/CPU/memory and timeout limits."""

    def test_process_limit_applied(self, fake_repo: Path) -> None:
        # Fork until it fails; with pids-limit set this must error out.
        prog = textwrap.dedent(
            """
            import os
            n = 0
            try:
                while n < 1000:
                    pid = os.fork()
                    if pid == 0:
                        import time; time.sleep(5)
                    n += 1
            except OSError:
                print('FORK_FAILED_AFTER', n)
                raise SystemExit(0)
            """
        ).strip()
        with SandboxWorkspace(fake_repo, SandboxConfig(timeout_seconds=40)) as ws:
            result = ws.run(["python", "-c", prog])
            assert "FORK_FAILED_AFTER" in result.stdout, result.stderr

    def test_long_command_terminated_at_timeout(self, fake_repo: Path) -> None:
        cfg = SandboxConfig(timeout_seconds=5)
        with SandboxWorkspace(fake_repo, cfg) as ws:
            t0 = time.monotonic()
            result = ws.run(["python", "-c", "import time; time.sleep(60)"])
            elapsed = time.monotonic() - t0
            assert result.timed_out
            assert elapsed < 45  # generous upper bound for container teardown

    def test_timed_out_container_is_removed(self, fake_repo: Path) -> None:
        cfg = SandboxConfig(timeout_seconds=4)
        with SandboxWorkspace(fake_repo, cfg) as ws:
            name = ws.container_name
            ws.run(["python", "-c", "import time; time.sleep(60)"])
        # After context exit, no container by that name should remain.
        out = subprocess.run(
            ["docker", "ps", "-a", "--filter", f"name={name}", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert name not in out.stdout


@skip_if_no_docker
@integration
class TestDockerLifecycleAndBoundedOutput:
    """Integration: temp dir cleanup, bounded output, session uniqueness."""

    def test_temp_dir_removed_after_context_exit(self, fake_repo: Path) -> None:
        with SandboxWorkspace(fake_repo) as ws:
            path = ws.workspace_path
            assert path is not None and path.exists()
        assert path is not None and not path.exists()

    def test_seeded_repo_tests_run_in_sandbox(self, seeded_repo: Path) -> None:
        with SandboxWorkspace(seeded_repo) as ws:
            result = ws.run(
                ["python", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"]
            )
            # The seeded repo has deliberately-failing contract tests; the
            # important assertion is that unittest actually *ran*. unittest
            # writes its summary to stderr, so check both streams.
            combined = result.stdout + result.stderr
            assert "Ran " in combined, combined
            assert "FAILED" in combined or "OK" in combined, combined

    def test_stdout_is_bounded(self, fake_repo: Path) -> None:
        cfg = SandboxConfig(max_output_bytes=2048)
        with SandboxWorkspace(fake_repo, cfg) as ws:
            result = ws.run(["python", "-c", "print('A'*1_000_000)"])
            assert result.truncated
            assert len(result.stdout) <= 2048 + 200  # marker headroom

    def test_two_sessions_use_different_dirs_and_names(self, seeded_repo: Path) -> None:
        with SandboxWorkspace(seeded_repo) as ws1, SandboxWorkspace(seeded_repo) as ws2:
            assert ws1.workspace_path != ws2.workspace_path
            assert ws1.container_name != ws2.container_name
            assert ws1.workspace_path is not None and ws1.workspace_path.exists()
            assert ws2.workspace_path is not None and ws2.workspace_path.exists()


# Provide the stdlib ``unittest``-discoverable name for the seeded repo.
if __name__ == "__main__":  # pragma: no cover
    raise SystemExit("run via: python -m pytest sandbox/tests -v")
