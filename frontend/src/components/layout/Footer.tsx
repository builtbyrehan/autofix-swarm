import Link from "next/link";

/**
 * Footer — minimal, mission-control flavored. Build info on the left,
 * tech attribution on the right. No heavy chrome; the page is the star.
 */

export function Footer() {
  return (
    <footer className="border-t border-glass-border/8 bg-glass-bg/30 backdrop-blur-md saturate-[140%]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="telemetry-label">v0.1.0</span>
          <span className="hidden sm:inline">·</span>
          <span>AutoFix Swarm — Autonomous Bug Detection & Remediation</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="transition-colors hover:text-foreground hover:text-glow-cyan">
            Overview
          </Link>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground hover:text-glow-cyan"
          >
            Dashboard
          </Link>
          <span className="hidden sm:inline">
            Powered by{" "}
            <span className="text-watcher">Codex</span>
            <span className="text-muted-foreground"> + </span>
            <span className="text-reviewer">GPT-5.6</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
