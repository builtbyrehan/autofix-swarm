import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — small monospace pill for statuses, severities, run IDs.
 * Monospace because most badges carry code-ish values (severity names,
 * short hashes) where alignment matters.
 */

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded",
    "font-mono text-xs font-medium uppercase tracking-wider",
    "border transition-colors",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral:
          "bg-muted/40 text-muted-foreground border-border",
        cyan:
          "bg-watcher/10 text-watcher border-watcher/30",
        teal: "bg-codex/10 text-codex border-codex/30",
        emerald:
          "bg-success/10 text-success border-success/30",
        warning:
          "bg-warning/10 text-warning border-warning/30",
        error:
          "bg-error/10 text-error border-error/30",
        critical:
          "bg-critical/15 text-critical border-critical/40",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ variant, className, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest} />
  );
}

export { badgeVariants };
