import { Badge } from "./Badge";
import type { SeverityLevel } from "@/types";

/**
 * SeverityBadge — maps a severity level to the right badge variant.
 * Used everywhere issues appear (dashboard, results timeline).
 */

const severityToVariant: Record<
  SeverityLevel,
  "critical" | "error" | "warning" | "neutral"
> = {
  critical: "critical",
  high: "error",
  medium: "warning",
  low: "neutral",
};

interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const normalized = String(severity).toLowerCase() as SeverityLevel;
  const variant =
    severityToVariant[normalized] ?? "neutral";
  return (
    <Badge variant={variant} className={className}>
      {normalized}
    </Badge>
  );
}
