import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Override the shimmer with a steady muted block. */
  static?: boolean;
}

export function Skeleton({ className, static: isStatic }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md",
        isStatic
          ? "bg-muted/40"
          : "shimmer-sweep",
        className
      )}
    />
  );
}
