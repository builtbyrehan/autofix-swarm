import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner — single consistent loader. Uses the primary cyan identity.
 * For HUD contexts where Loader2's outline reads as too "app-like",
 * there's also a `ring` variant (pure CSS conic gradient).
 */

interface SpinnerProps {
  size?: number;
  className?: string;
  variant?: "icon" | "ring";
  label?: string;
}

export function Spinner({
  size = 16,
  className,
  variant = "icon",
  label,
}: SpinnerProps) {
  if (variant === "ring") {
    return (
      <span
        role="status"
        aria-label={label ?? "Loading"}
        className={cn(
          "inline-block rounded-full border-2 border-muted/30",
          "border-t-primary animate-spin",
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Loader2
      role="status"
      aria-label={label ?? "Loading"}
      style={{ width: size, height: size }}
      className={cn("animate-spin text-primary", className)}
    />
  );
}
