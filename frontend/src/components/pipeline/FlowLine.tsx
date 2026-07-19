/**
 * FlowLine — animated 2D SVG connector between pipeline nodes.
 * Used by PipelineGraph (the 2D fallback renderer). Marching ants dash
 * animation via CSS (see globals.css .flow-dash).
 */

import { cn } from "@/lib/utils";

interface FlowLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Agent identity color (hsl string). */
  color: string;
  /** Active = animated dash. */
  active?: boolean;
  /** Stage is complete = solid filled line. */
  completed?: boolean;
}

export function FlowLine({
  x1,
  y1,
  x2,
  y2,
  color,
  active = false,
  completed = false,
}: FlowLineProps) {
  return (
    <g>
      {/* Base track */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="hsl(217 33% 18%)"
        strokeWidth="2"
      />
      {/* Active/completed overlay */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2"
        className={cn(
          active && !completed && "flow-dash",
          completed && "opacity-100",
          !active && !completed && "opacity-0"
        )}
        style={{
          transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </g>
  );
}
