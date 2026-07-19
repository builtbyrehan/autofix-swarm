/**
 * Device-capability detection for choosing 3D vs 2D pipeline renderer.
 *
 * Three signals, any one of which forces the 2D fallback:
 *   1. No WebGL support (older browsers, software rendering disabled)
 *   2. prefers-reduced-motion (accessibility — respect it)
 *   3. Low-power heuristics (few cores, no hardware GPU)
 *
 * The check is memoized per-page-load and is safe to call during render
 * (returns false on the server and during the first client paint).
 */

export type RenderTier = "3d" | "2d";

let cachedTier: RenderTier | null = null;

/**
 * Detect whether the browser can render a WebGL context. We try WebGL2 first
 * (preferred by three.js) then fall back to legacy WebGL.
 */
function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Confirm the context is actually backed by a GPU — software WebGL
    // (SwiftShader) reports a renderer string we can sniff.
    const debugInfo = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_debug_renderer_info"
    );
    if (debugInfo) {
      const renderer = (
        gl as WebGLRenderingContext
      ).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // Common software renderer substrings — fall back to 2D for these.
      if (/swiftshader|llvmpipe|software/i.test(String(renderer))) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // deviceMemory is Chromium-only and opt-in, but a strong signal where present.
  // Below 4 GB we conservatively fall back.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory < 4) return true;
  // Few logical cores = weak CPU; the 3D scene does continuous work.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores < 4) return true;
  // Save-Data header support = user explicitly requested low-bandwidth mode.
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (conn?.saveData) return true;
  return false;
}

/**
 * Resolve the render tier. Memoized after the first call so the choice is
 * stable across re-renders within a session.
 */
export function getRenderTier(): RenderTier {
  if (cachedTier) return cachedTier;
  if (typeof window === "undefined") {
    // SSR / first paint — defer the decision; component should treat this
    // as 2D until the effect re-checks on the client.
    return "2d";
  }
  const tier: RenderTier =
    hasWebGL() && !prefersReducedMotion() && !isLowPowerDevice() ? "3d" : "2d";
  cachedTier = tier;
  return tier;
}

/**
 * Reset the memoized tier. Useful for tests or if a user toggles
 * prefers-reduced-motion mid-session and the host wants to re-resolve.
 */
export function resetRenderTier(): void {
  cachedTier = null;
}
