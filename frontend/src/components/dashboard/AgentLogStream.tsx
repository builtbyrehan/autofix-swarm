"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION, ease, EASE } from "@/lib/easing";
import type { AgentLogEntry, AgentName } from "@/types";

interface AgentLogStreamProps {
  logs: AgentLogEntry[];
  filterAgent?: AgentName | null;
  activeAgent?: AgentName | null;
  className?: string;
}

const agentColors: Record<AgentName, string> = {
  watcher: "text-watcher",
  codex: "text-codex",
  reviewer: "text-reviewer",
};

const levelColors: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-success",
  warn: "text-warning",
  error: "text-error",
  debug: "text-muted-foreground/70",
};

const agentLabels: Record<AgentName, string> = {
  watcher: "WATCHER",
  codex: "CODEX",
  reviewer: "REVIEWER",
};

export function AgentLogStream({
  logs,
  filterAgent,
  activeAgent,
  className,
}: AgentLogStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typingIndex, setTypingIndex] = useState(-1);
  const [typedChars, setTypedChars] = useState(0);
  const prevLength = useRef(logs.length);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, typedChars]);

  // When a new log line arrives, start "typing" it
  useEffect(() => {
    if (logs.length > prevLength.current) {
      // New line(s) arrived — start typing the last one
      setTypingIndex(logs.length - 1);
      setTypedChars(0);
    }
    prevLength.current = logs.length;
  }, [logs.length]);

  // Type out the message character by character
  useEffect(() => {
    if (typingIndex < 0 || typingIndex >= logs.length) return;
    const msg = logs[typingIndex].message;
    if (typedChars >= msg.length) {
      setTypingIndex(-1);
      return;
    }
    const speed = Math.max(8, Math.min(40, Math.floor(80 / msg.length)));
    const timer = setTimeout(() => {
      setTypedChars((c) => c + 1);
    }, speed);
    return () => clearTimeout(timer);
  }, [typingIndex, typedChars, logs]);

  const filtered = filterAgent
    ? logs.filter((l) => l.agent === filterAgent)
    : logs;

  const displayAgent = filterAgent ?? activeAgent;

  // Determine the displayed message for each line
  const displayLine = (entry: AgentLogEntry, i: number): string => {
    if (i === typingIndex) {
      return entry.message.slice(0, typedChars);
    }
    return entry.message;
  };

  return (
    <div className={cn("terminal-panel flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="telemetry-label">
          {displayAgent
            ? `${agentLabels[displayAgent]} Log`
            : "Agent Activity Log"}
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          {filtered.length} lines
        </span>
      </div>

      {/* Log body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
        style={{ maxHeight: 320, minHeight: 160 }}
      >
        <AnimatePresence initial={false}>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground/50 italic">
              Waiting for activity<span className="animate-pulse">...</span>
            </p>
          ) : (
            filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: DURATION.fast,
                  ease: ease(EASE.primary),
                }}
                className={cn(
                  "mb-0.5 flex items-start gap-2",
                  levelColors[entry.level] ?? "text-muted-foreground"
                )}
              >
                {/* Agent tag */}
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    agentColors[entry.agent]
                  )}
                >
                  [{agentLabels[entry.agent]}]
                </span>

                {/* Timestamp */}
                <span className="shrink-0 text-muted-foreground/50">
                  {new Date(entry.ts).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>

                {/* Message with typing effect */}
                <span className="break-words">
                  {displayLine(entry, i)}
                  {i === typingIndex && typedChars < entry.message.length && (
                    <span className="blink-cursor" />
                  )}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Blinking cursor at the end when idle */}
        {typingIndex === -1 && filtered.length > 0 && (
          <span className="inline-block h-4 w-2 translate-y-0.5 bg-watcher/70 animate-pulse" />
        )}
      </div>
    </div>
  );
}
