"use client";

import { forwardRef, useCallback, type HTMLAttributes, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Tilt3DCard } from "./Tilt3DCard";
import type { ElevationTier } from "./Elevation";

export type { ElevationTier };
export type GlowState =
  | "none"
  | "cyan"
  | "teal"
  | "emerald"
  | "error"
  | "warning";

export interface HudPanelProps extends HTMLAttributes<HTMLDivElement> {
  elev?: ElevationTier;
  brackets?: boolean;
  bracketsActive?: boolean;
  glow?: GlowState;
  as?: "div" | "section" | "article" | "aside" | "header" | "footer";
  /** Enable mouse-reactive radial glow that follows cursor. */
  hoverGlow?: boolean;
  /** Enable CSS 3D mouse-tilt (wraps content in Tilt3DCard). Default: false */
  tilt?: boolean;
}

const glowClass: Record<GlowState, string> = {
  none: "",
  cyan: "glow-cyan",
  teal: "glow-teal",
  emerald: "glow-emerald",
  error: "glow-error",
  warning: "glow-warning",
};

export const HudPanel = forwardRef<HTMLDivElement, HudPanelProps>(
  function HudPanel(
    {
      elev = 1,
      brackets = false,
      bracketsActive = false,
      glow = "none",
      hoverGlow = false,
      tilt = false,
      as: Tag = "div",
      className,
      children,
      style,
      onMouseMove,
      ...rest
    },
    ref
  ) {
    const handleMouseMove = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        onMouseMove?.(e);
        if (!hoverGlow) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
        e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
      },
      [hoverGlow, onMouseMove]
    );

    const panel = (
      <Tag
        ref={ref as never}
        data-elev={elev}
        data-active={bracketsActive ? "true" : undefined}
        className={cn(
          "hud-panel",
          brackets && "hud-brackets",
          hoverGlow && "hover-glow",
          glowClass[glow],
          className
        )}
        onMouseMove={handleMouseMove}
        style={style}
        {...rest}
      >
        {children}
      </Tag>
    );

    /* Wrap in Tilt3DCard when tilt is requested */
    if (tilt) {
      return <Tilt3DCard>{panel}</Tilt3DCard>;
    }

    return panel;
  }
);
