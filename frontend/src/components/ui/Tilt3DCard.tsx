"use client";

import {
  useRef,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Tilt3DCard — pointer-driven CSS 3D tilt wrapper.
 *
 * Tracks the mouse position within the card and applies
 * rotateX / rotateY (max ±8°) via CSS custom properties consumed
 * by the `.tilt-3d` utility in globals.css. A specular glare
 * overlay (`.tilt-glare`) follows the cursor to reinforce the
 * "floating glass" look.
 *
 * Honors prefers-reduced-motion: the CSS layer kills the transform
 * and hides the glare when reduced-motion is active.
 *
 * Usage:
 *   <Tilt3DCard>
 *     <HudPanel>…</HudPanel>
 *   </Tilt3DCard>
 */

const MAX_ANGLE = 8; // degrees — matches --tilt-max in CSS

export interface Tilt3DCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Disable tilt (e.g. touch devices or explicit override). Default: false */
  disabled?: boolean;
  /** Custom max tilt in degrees. Default: 8 */
  maxAngle?: number;
}

export function Tilt3DCard({
  children,
  disabled = false,
  maxAngle = MAX_ANGLE,
  className,
  onMouseMove,
  onMouseLeave,
  ...rest
}: Tilt3DCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(e);
      if (disabled || !ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;  // 0..1
      const y = (e.clientY - rect.top) / rect.height;   // 0..1
      const rotateY = (x - 0.5) * 2 * -maxAngle;      // left → +, right → -
      const rotateX = (y - 0.5) * 2 * maxAngle;       // top → -, bottom → +

      ref.current.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
      ref.current.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);

      /* Glare follows cursor — percentage within the card */
      ref.current.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      ref.current.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      ref.current.style.setProperty("--glare", "1");
    },
    [disabled, maxAngle, onMouseMove]
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      if (!ref.current) return;
      /* Spring back to flat */
      ref.current.style.setProperty("--rx", "0deg");
      ref.current.style.setProperty("--ry", "0deg");
      ref.current.style.setProperty("--glare", "0");
    },
    [onMouseLeave]
  );

  return (
    <div className={cn("perspective-3d", className)} {...rest}>
      <div
        ref={ref}
        className="tilt-3d relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Glare overlay */}
        <div className="tilt-glare" aria-hidden="true" />
        {/* Content at z=1 so glare sits behind it (z-index in glare is 1, but
            children get relative z-2 via the utility) */}
        <div className="relative z-[2]">{children}</div>
      </div>
    </div>
  );
}
