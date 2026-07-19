"use client";

import { FileCode } from "lucide-react";
import { HudPanel } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * DiffViewer — simple inline diff renderer for fix previews.
 * In production this would use react-diff-viewer-continued.
 * For now we render a basic unified diff with added/removed line highlighting.
 */

interface DiffViewerProps {
  /** Raw unified diff text. */
  diff?: string;
  /** Short preview (first few lines). */
  diffPreview?: string;
  className?: string;
  /** Show full diff or just preview. */
  expanded?: boolean;
}

export function DiffViewer({
  diff,
  diffPreview,
  className,
  expanded = false,
}: DiffViewerProps) {
  const content = expanded && diff ? diff : diffPreview;

  if (!content) return null;

  const lines = content.split("\n");

  return (
    <HudPanel brackets className={cn("p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <FileCode className="h-4 w-4 text-codex" />
        <p className="telemetry-label">Diff Preview</p>
      </div>

      <pre className="overflow-x-auto rounded bg-bg-0 p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          let lineClass = "";
          let prefix = " ";

          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = "diff-line-added";
            prefix = "+";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = "diff-line-removed";
            prefix = "-";
          } else if (line.startsWith("@@")) {
            lineClass = "text-watcher";
            prefix = "@";
          }

          return (
            <div key={i} className={cn("flex", lineClass)}>
              <span className="mr-3 w-4 shrink-0 text-right text-muted-foreground/40 select-none">
                {prefix}
              </span>
              <span className="text-foreground/80">{line}</span>
            </div>
          );
        })}
      </pre>
    </HudPanel>
  );
}
