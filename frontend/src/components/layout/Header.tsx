"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import { useHealth } from "@/hooks/useHealth";
import { StatusDot, type StatusState } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Command Center" },
  { href: "/results/latest", label: "Results" },
];

function useUtcClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toISOString().slice(11, 19));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function Header() {
  const pathname = usePathname();
  const { health, isReachable } = useHealth();
  const clock = useUtcClock();

  return (
    <header className="sticky top-0 z-50 border-b border-glass-border/10 bg-glass-bg/40 backdrop-blur-2xl saturate-[160%]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="AutoFix Swarm home"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center perspective-3d">
            <span className="preserve-3d transition-transform duration-400 ease-primary group-hover:rotateY-0 [transform:rotateY(0deg)] group-hover:[transform:rotateY(180deg)]">
              <Terminal className="h-5 w-5 text-watcher" />
            </span>
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-watcher"
              style={{
                boxShadow: "0 0 8px hsl(var(--agent-watcher))",
                animation: "radar-pulse 2s var(--ease-primary) infinite",
              }}
            />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              AutoFix Swarm
            </span>
            <span className="telemetry-label text-[10px]">
              Mission Control
            </span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href.split("?")[0]);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-card/60 text-foreground shadow-elev0"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* System status + UTC clock */}
        <div className="flex items-center gap-3">
          {/* Mission clock */}
          <span className="hidden font-mono text-[10px] tracking-wider text-muted-foreground/60 lg:inline">
            {clock} UTC
          </span>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-watcher/40 hover:text-foreground"
            title="System health"
          >
            <Activity className="h-3.5 w-3.5 text-watcher" />
            <span className="telemetry-label hidden sm:inline">
              {isReachable ? (health?.status ?? "online") : "offline"}
            </span>
          </Link>

          <SystemStatuses health={health} reachable={isReachable} />
        </div>
      </div>
    </header>
  );
}

function SystemStatuses({
  health,
  reachable,
}: {
  health: { codex_available?: boolean; gpt_available?: boolean; database_connected?: boolean } | null;
  reachable: boolean;
}) {
  const toState = (ok?: boolean): StatusState =>
    !reachable ? "idle" : ok ? "success" : "warning";

  const items = [
    { key: "Database", state: toState(health?.database_connected) },
    { key: "Codex", state: toState(health?.codex_available) },
    { key: "GPT-5.6", state: toState(health?.gpt_available) },
  ];

  return (
    <div className="flex items-center gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-1.5"
          title={`${item.key}: ${
            item.state === "idle"
              ? "unknown"
              : item.state === "success"
                ? "available"
                : "degraded"
          }`}
        >
          <StatusDot state={item.state} />
          <span className="telemetry-label hidden lg:inline">{item.key}</span>
        </div>
      ))}
    </div>
  );
}
