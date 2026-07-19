import { cn } from "@/lib/utils";

/**
 * StatusDot — pulsing radar indicator. Pure CSS (see globals.css),
 * no JS animation cost. Respects prefers-reduced-motion automatically.
 *
 * Pair with a label in a flex row: `<div class="flex items-center gap-2">
 * <StatusDot state="success" /> Database</div>`
 */

export type StatusState =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "idle";

interface StatusDotProps {
  state: StatusState;
  className?: string;
  /** Override the pulse (e.g. a steady "armed" indicator). */
  pulse?: boolean;
}

export function StatusDot({ state, className, pulse = true }: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={state}
      data-state={state}
      className={cn("status-dot", !pulse && "status-dot-static", className)}
      // When pulse is false we suppress the radar ring via inline style.
      style={
        !pulse
          ? ({ ["--dot-pulse" as string]: "none" } as React.CSSProperties)
          : undefined
      }
    />
  );
}
