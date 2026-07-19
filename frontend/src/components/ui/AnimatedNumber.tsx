"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  useInView,
  useMotionValue,
  useTransform,
  motion,
} from "framer-motion";
import { DURATION } from "@/lib/easing";
import { cn } from "@/lib/utils";

/**
 * AnimatedNumber — count-up on mount (and when `value` changes).
 *
 * Uses a single motion value animated via framer-motion's `animate()`,
 * rendered through a formatter so decimals, percent signs, and unit
 * suffixes all work without re-animating layout.
 *
 * Triggers when scrolled into view (useInView) so off-screen counters
 * don't fire and burn CPU.
 */

interface AnimatedNumberProps {
  value: number;
  /** Decimals to render. Default 0. */
  decimals?: number;
  /** Formatter override (e.g. for currency, durations). */
  format?: (n: number) => string;
  /** Suffix appended after the formatted number (e.g. "s", "%"). */
  suffix?: string;
  /** Animate from this value on first mount. Default 0. */
  from?: number;
  className?: string;
  /** Disable animation, render the value directly. */
  disabled?: boolean;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  format,
  suffix = "",
  from = 0,
  className,
  disabled = false,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(from);

  // Render target — formats the live motion value to a string.
  const display = useTransform(mv, (latest) => {
    const n = Number.isFinite(latest) ? latest : 0;
    if (format) return format(n);
    return n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });

  useEffect(() => {
    if (disabled || !inView) return;
    const controls = animate(mv, value, {
      duration: DURATION.slow,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [value, inView, disabled, mv]);

  if (disabled) {
    return (
      <span ref={ref} className={cn("tabular-nums", className)}>
        {format ? format(value) : value.toFixed(decimals)}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
