# Watcher agent

The Watcher scans a target repository and emits the array contract in `../eval/schemas/issue.schema.json`. It only detects and describes issues; it never modifies source code.

Run the default backend:

```powershell
.\.venv\Scripts\python.exe -m agents.watcher seeded_repo --output artifacts/issues.json
```

Backends:

- `auto`: built-in static analysis on Windows; native Semgrep elsewhere.
- `builtin`: local Python AST analysis implementing four general deterministic rules.
- `native`: locally installed Semgrep CE using `rules/semgrep-python.yml`.
- `docker`: pinned `semgrep/semgrep:1.170.0` with read-only target/rule mounts and `--network none`.

The built-in backend exists for hosts where executable policy blocks the Semgrep engine or the container image is unavailable. Its output is explicitly labeled `builtin-static`. It must never be described as Semgrep output.

GPT-5.6 gap analysis is not implemented or simulated. It remains a required submission gap until real access is available.
