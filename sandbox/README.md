# AutoFix Swarm — Sandbox

A Docker-based disposable workspace that lets the **Codex Fixer** and the
**Reviewer** run generated code and deterministic tests **without** letting that
code touch the original repository, the host filesystem, or the network.

This is the isolation mechanism the project's hard rules require. Per the
sandbox build specification, this module implements **full Docker isolation**
(even though the root README and `important files/rules.md` describe "lightweight
isolation" as the v1 baseline — the sandbox spec explicitly mandates the
stronger Docker controls listed below).

> **Scope note:** This README documents only the sandbox. The Watcher, Codex
> Fixer, Reviewer, orchestrator, backend, and frontend are out of scope for
> this component.

---

## What the sandbox protects

- **The original repository.** Generated code never runs against it. Every
  session gets a unique temporary *copy*, and only that copy is mounted into a
  container. The original is read-only from the sandbox's perspective.
- **The host filesystem.** The container's root filesystem is `--read-only`,
  all Linux capabilities are dropped (`--cap-drop ALL`), `no-new-privileges`
  is set, and the only host directory mounted is the per-session temp copy at
  `/workspace`. Writes to paths outside `/workspace` (e.g. `/escape.txt`) fail.
- **The network.** Containers start with `--network none`. Untrusted generated
  code and tests cannot reach the internet, resolve DNS, or open outbound
  sockets. (Integration tests prove this with a short socket/DNS attempt —
  *not* a live external website.)
- **Host resources.** Every run is bounded by `--memory`, `--cpus`,
  `--pids-limit`, a per-command timeout, and capped `stdout`/`stderr` capture,
  so malicious or broken code can't run forever or consume unbounded
  memory/processes.
- **Secrets.** `.env`, `.env.*` (except `.env.example`), `.git`, virtual
  environments, caches, dependency folders, and credential/key files are never
  copied into the workspace.

## What the sandbox does **not** protect

- **It is not a claim of production-grade protection against every possible
  container escape.** This is *prototype* isolation for a build-week demo. It
  uses Docker's standard isolation primitives; it is not a hardened sandbox
  VM, seccomp profile, or gVisor-style boundary.
- It does **not** isolate the *trusted controller* (the host process that calls
  Codex / GPT-5.6). Model/API communication belongs to a trusted boundary
  outside this sandbox and may legitimately need network access. Only
  *generated-code execution and deterministic tests* are forced offline.
- It does not protect against bugs in Docker itself, the kernel, or the host.
- It does not verify that the chosen container image is free of supply-chain
  compromise — it trusts a pinned public image (`python:3.11-slim` by default).

## Why Docker

A plain `subprocess` runs code with the full privileges of the host process —
no filesystem confinement, no network block, no resource ceiling. Docker gives
real, verifiable versions of all three: a read-only root, an isolated network
namespace (`--network none`), cgroup-backed memory/CPU/pid limits, and a
capability-dropped process. For *prototype* isolation, that is a credible
step up from a subprocess, and it can be demonstrated with concrete tests
(writes outside `/workspace` fail, sockets fail, timeouts clean up).

The sandbox deliberately refuses to fall back to a local subprocess if Docker
is unavailable — a silent fallback would create a false sense of isolation. It
raises `DockerUnavailableError` instead.

## Temporary-copy lifecycle

1. `SandboxWorkspace(repo_path)` resolves and validates the source path (must
   exist, be a directory, and not be a filesystem root).
2. Docker availability is probed (`docker info`); if unavailable,
   `DockerUnavailableError` is raised and nothing is created.
3. A unique temp directory is created (prefix `afs-sandbox-`) containing a
   `workspace-<id>/` folder.
4. The repository is copied into `workspace-<id>/` **recursively, by content**:
   - excluded patterns (`.git`, `.env`, `.venv`, `node_modules`, `__pycache__`,
     `*.pyc`, `artifacts`, key/credential files, …) are skipped,
   - `.env.example` is kept (no secret values),
   - symlinks are resolved; any symlink whose target **escapes** the repository
     is rejected with `SandboxError`,
   - the original repository is never written to.
5. `run([...])` launches one `docker run` per command with the temp copy mounted
   at `/workspace` (read-write) and every hardening flag set.
6. `create_diff()` returns a deterministic unified diff between the original and
   the (possibly mutated) workspace copy, computed host-side so the original is
   only ever read.
7. `close()` / context-manager exit removes the container (best-effort
   `docker stop` + `docker rm -f`) and deletes the entire temp directory.
   Cleanup is **idempotent** and runs even after a timeout or exception.

```python
from sandbox import SandboxWorkspace, SandboxConfig

config = SandboxConfig(container_image="python:3.11-slim", timeout_seconds=60)
with SandboxWorkspace("seeded_repo", config=config) as sandbox:
    result = sandbox.run(["python", "-m", "unittest", "discover", "-s", "tests"])
    patch = sandbox.create_diff()
    print(result.success, result.exit_code)
```

> Paths returned by the workspace (e.g. `workspace_path`) are **diagnostic
> only** after `close()` — the directory no longer exists.

## Network policy

- Container flag: `--network none`.
- No outbound TCP/UDP, no DNS resolution.
- The trusted controller boundary (Codex / GPT-5.6 calls) is **outside** this
  sandbox and is not constrained by it. Generated-code execution and
  deterministic tests are offline.
- Cached model output may be replayed as evidence during the demo but must
  **never** be presented as a live model call.

## Filesystem policy

- Container root: `--read-only`.
- Container processes run as the non-root numeric user `1000:1000` by
  default (`--user`); root and named-user values are rejected by configuration.
- Only writable surfaces: the mounted `/workspace` (the temp copy) and a small
  `/tmp` tmpfs.
- Never mounted: the original repo, the workspace *root*, the user's home
  directory, the Docker socket, SSH config, Git credentials, `.env` files, or
  any broad host directory.
- `..` traversal and absolute-path writes outside `/workspace` fail at runtime
  (covered by integration tests).

## Resource limits

| Limit | Default | Docker flag |
|---|---|---|
| Wall-clock timeout per command | 60 s | enforced in Python; container then stopped |
| Memory | `512m` | `--memory` |
| CPUs | `1.0` | `--cpus` |
| Processes (pids) | 64 | `--pids-limit` |
| Captured stdout/stderr | 1 MiB each | truncated in Python with a marker |
| `/tmp` tmpfs | 64 MiB | `--tmpfs` |

All limits are configurable on `SandboxConfig` and validated eagerly.

## Command policy

Only an explicit allowlist may run inside the container:

- `python`, `python3`, `python3.11`–`python3.13`
- `pytest`
- `git` (only when local diff generation is requested)

Anything else raises `CommandValidationError`. The sandbox:

- **never** uses `shell=True` — commands are always argument arrays,
- **never** runs `sh`/`bash`/`cmd`/`powershell` with user-generated strings,
- **never** installs packages after networking is disabled,
- **never** allows Docker-in-Docker or mounting the Docker socket.

Seeded tests run with the standard library (`python -m unittest discover …`),
so the container needs no network-installed packages.

## Failure and cleanup behavior

- **Normal command failure** (non-zero exit) → returned as a `SandboxResult`
  with that exit code. *Not* an exception.
- **Infrastructure failure** (Docker not found, daemon error, container cannot
  start) → raises `SandboxExecutionError`.
- **Docker unavailable** → raises `DockerUnavailableError`. No fallback.
- **Timeout** → the result is marked `timed_out=True`, the `docker run` client
  is terminated, the uniquely-named container is stopped and force-removed, and
  the temp directory is deleted. No container is left running.
- **Exception/timeout during a session** → `close()` still removes the container
  and temp dir. Cleanup never raises.

## How the Fixer uses the sandbox

The Codex Fixer is the *only* component that writes/applies fixes. It uses the
sandbox to apply a candidate patch to the disposable copy and produce a diff
**without ever touching the original repo**:

```python
with SandboxWorkspace(repo, config) as ws:
    # apply candidate fix (Codex-generated) into the workspace copy only
    ws.run(["python", "apply_fix.py"])
    patch = ws.create_diff()   # diff of original vs. patched copy
```

## How the Reviewer uses the sandbox

The Reviewer runs the deterministic test suite against the patched copy and
records pass/fail. GPT-5.6 only *explains* the result; it never re-writes the
fix, and it runs in the trusted controller boundary, not here:

```python
with SandboxWorkspace(repo, config) as ws:
    result = ws.run(["python", "-m", "unittest", "discover", "-s", "tests"])
    tests_passed = result.success
```

## Supported platform assumptions

- **Python 3.11+** on the host (developed against 3.14).
- **Docker Desktop** with the Linux engine, verified on Windows. Also works on
  macOS/Linux where Docker is available.
- `python:3.11-slim` (or a configurable alternative) must be pullable from the
  image registry before the first run.
- Creating symlinks on the host is *not* required; escaping-symlink rejection
  is enforced regardless of OS symlink support.

## How to run tests

```powershell
# Unit tests only (no Docker, no network):
python -m pytest sandbox/tests -v -m "not integration"

# Full suite including Docker integration tests (requires Docker Desktop):
python -m pytest sandbox/tests -v

# Regression check the existing eval harness:
python -m pytest eval/tests -v
```

Integration tests are marked `@pytest.mark.integration` and are skipped with a
clear reason when Docker is unavailable — but per the completion criteria they
must pass on a machine where Docker works before this work is considered done.

After running, confirm no leftover containers:

```powershell
docker ps -a --filter "name=afs-sandbox-"
```

The list must be empty.

## Current limitations

- **Prototype isolation**, not production-grade. No custom seccomp/AppArmor
  profile, no gVisor/kata, no user-namespace remapping beyond Docker defaults.
- Single-language (Python) command surface; commands are restricted to the
  allowlist above.
- No retry loop (consistent with the project's v1 scope) — a failed/timeout run
  is reported, not retried, by this component.
- The container uses a fixed non-root numeric uid/gid (`1000:1000`) and does
  not use Docker user-namespace remapping. Stronger kernel isolation such as
  gVisor or Kata remains outside the prototype scope.
- Diff generation is textual (`difflib`), not `git`-based by default, to avoid
  requiring `git` inside the container.
