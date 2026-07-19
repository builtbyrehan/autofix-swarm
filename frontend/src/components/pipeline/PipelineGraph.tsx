"use client";

import { useMemo } from "react";
import { FlowLine } from "./FlowLine";
import { cn } from "@/lib/utils";

/**
 * PipelineGraph — 2D SVG fallback renderer for low-power devices and
 * reduced-motion users. Renders the same pipeline data as the 3D scene.
 *
 * Three agent nodes (Watcher / Codex / Reviewer) in a horizontal layout
 * with animated flow lines between them. Active stage pulses, completed
 * stages glow solid.
 */

interface PipelineGraphProps {
  stage: string;
  progress: number;
  isRunning: boolean;
  onNodeClick?: (agent: string) => void;
}

const NODES = [
  { agent: "watcher", label: "Watcher", x: 120, color: "hsl(199 89% 48%)", accent: "text-watcher" },
  { agent: "codex", label: "Codex", x: 400, color: "hsl(173 80% 45%)", accent: "text-codex" },
  { agent: "reviewer", label: "Reviewer", x: 680, color: "hsl(158 64% 45%)", accent: "text-reviewer" },
] as const;

const STAGE_ORDER = ["idle", "scanning", "fixing", "verifying", "completed"];

export function PipelineGraph({
  stage,
  progress,
  isRunning,
  onNodeClick,
}: PipelineGraphProps) {
  const stageIndex = STAGE_ORDER.indexOf(stage);

  const activeAgent = useMemo(() => {
    if (stage === "scanning") return "watcher";
    if (stage === "fixing") return "codex";
    if (stage === "verifying") return "reviewer";
    if (stage === "completed") return "reviewer";
    return null;
  }, [stage]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-bg-0/60 border border-border" style={{ minHeight: 280 }}>
      <svg
        viewBox="0 0 800 200"
        className="h-auto w-full"
        fill="none"
        aria-label="Pipeline visualization"
        role="img"
      >
        {/* Flow lines between nodes */}
        {NODES.slice(0, -1).map((node, i) => {
          const next = NODES[i + 1];
          const fromIdx = STAGE_ORDER.indexOf(
            node.agent === "watcher" ? "scanning" : node.agent === "codex" ? "fixing" : "verifying"
          );
          const toIdx = fromIdx + 1;
          const connected = stageIndex >= fromIdx;
          const active = stageIndex === fromIdx;

          return (
            <FlowLine
              key={`flow-${node.agent}`}
              x1={node.x + 50}
              y1={100}
              x2={next.x - 50}
              y2={100}
              color={next.color}
              active={active}
              completed={stageIndex > fromIdx}
            />
          );
        })}

        {/* Agent nodes */}
        {NODES.map((node, i) => {
          const isActive = activeAgent === node.agent;
          const isCompleted = stageIndex > NODES.indexOf(node) + 1 || (node.agent === "reviewer" && stage === "completed");

          return (
            <g
              key={node.agent}
              onClick={() => onNodeClick?.(node.agent)}
              style={{ cursor: onNodeClick ? "pointer" : "default" }}
              className="transition-opacity"
            >
              {/* Glow ring */}
              <circle
                cx={node.x}
                cy={100}
                r={48}
                fill={isActive ? `${node.color}12` : "transparent"}
                className={cn("transition-all duration-700", isActive && "timeline-pulse")}
              />

              {/* Node circle */}
              <circle
                cx={node.x}
                cy={100}
                r={36}
                fill={isActive ? `${node.color}18` : "hsl(217 33% 11%)"}
                stroke={isActive || isCompleted ? node.color : "hsl(217 33% 18%)"}
                strokeWidth={isActive ? 2.5 : 1.5}
                className="transition-all duration-500"
                style={{
                  filter: isActive ? `drop-shadow(0 0 12px ${node.color})` : "none",
                }}
              />

              {/* Stage number */}
              <text
                x={node.x}
                y={88}
                textAnchor="middle"
                fill={node.color}
                fontFamily="var(--font-mono)"
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.1em"
                className={isActive ? "opacity-100" : "opacity-60"}
              >
                {String(i + 1).padStart(2, "0")}
              </text>

              {/* Agent icon (simplified) */}
              <text
                x={node.x}
                y={108}
                textAnchor="middle"
                fill={node.color}
                fontFamily="var(--font-mono)"
                fontSize="20"
                className={isActive ? "opacity-100" : "opacity-50"}
              >
                {node.agent === "watcher" ? "◎" : node.agent === "codex" ? "◇" : "◈"}
              </text>

              {/* Label */}
              <text
                x={node.x}
                y={164}
                textAnchor="middle"
                fill={isActive ? node.color : "hsl(215 20% 65%)"}
                fontFamily="var(--font-mono)"
                fontSize="12"
                fontWeight="500"
                letterSpacing="0.08em"
                className="transition-colors duration-300"
              >
                {node.label.toUpperCase()}
              </text>

              {/* Status indicator under label */}
              <text
                x={node.x}
                y={180}
                textAnchor="middle"
                fill="hsl(215 20% 65%)"
                fontFamily="var(--font-mono)"
                fontSize="9"
                opacity={isActive ? 1 : 0}
                className="transition-opacity duration-500"
              >
                {isActive ? `${Math.round(progress * 100)}%` : isCompleted ? "DONE" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
