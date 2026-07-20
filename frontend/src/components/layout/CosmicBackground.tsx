"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getRenderTier, type RenderTier } from "@/lib/capability";
import { Starfield2D } from "./Starfield2D";

/**
 * CosmicBackground — site-wide animated starfield.
 *
 * Gating strategy (mirrors PipelineRenderer):
 *   - 3D tier + no reduced-motion → lazy-loads Starfield3D (WebGL/R3F).
 *   - 2D tier / reduced-motion / SSR → renders lightweight Starfield2D (canvas).
 *
 * The R3F bundle is loaded via next/dynamic (ssr: false) so it never ships
 * to the server or to users who fall back to 2D.
 *
 * A vignette overlay sits on top of whichever starfield renders so center
 * content stays readable against the stars.
 */

const Starfield3DLazy = dynamic(
  () =>
    import("./Starfield3D").then((mod) => ({
      default: mod.Starfield3D,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function CosmicBackground() {
  const [tier, setTier] = useState<RenderTier>("2d");
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setTier(getRenderTier());
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const useWebGL = tier === "3d" && !reducedMotion;

  return (
    <>
      {/* Starfield layer */}
      {useWebGL ? <Starfield3DLazy /> : <Starfield2D />}

      {/* Vignette overlay — darkens edges so center content reads as focal */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 40%, transparent 30%, hsl(var(--bg-0) / 0.65) 100%)",
          zIndex: -9,
        }}
      />
    </>
  );
}
