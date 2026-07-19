"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getRenderTier, type RenderTier } from "@/lib/capability";
import { PipelineGraph } from "./PipelineGraph";
import { Skeleton } from "@/components/ui";

/**
 * PipelineRenderer — checks device capability and renders either the 3D scene
 * (react-three-fiber) or the 2D SVG fallback.
 *
 * The 3D bundle is loaded lazily via next/dynamic with ssr:false so it never
 * ships to users who fall back to 2D.
 */

// Dynamic import — three.js never loads on the server or for 2D-tier users.
const PipelineSceneLazy = dynamic(
  () => import("./PipelineScene").then((mod) => ({ default: mod.PipelineScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    ),
  }
);

export interface PipelineRendererProps {
  /** Current pipeline stage. */
  stage: string;
  /** 0–1 progress within the current stage. */
  progress: number;
  /** True when a run is in flight. */
  isRunning: boolean;
  /** Agent log entries for click-to-filter linking. */
  onNodeClick?: (agent: string) => void;
}

export function PipelineRenderer(props: PipelineRendererProps) {
  const [tier, setTier] = useState<RenderTier>("2d");

  useEffect(() => {
    setTier(getRenderTier());
  }, []);

  if (tier === "3d") {
    return <PipelineSceneLazy {...props} />;
  }

  return <PipelineGraph {...props} />;
}
