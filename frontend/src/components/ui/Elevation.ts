/**
 * Elevation — token helpers for the elevation system defined in globals.css.
 *
 * Maps elevation tiers to their CSS class names and provides convenience
 * constants for programmatic use (e.g. dynamic shadow rendering in 3D scene,
 * determining border brightness from elevation tier).
 */

export type ElevationTier = 0 | 1 | 2 | 3;

/** CSS class names per elevation tier. */
export const ELEVATION_CLASS: Record<ElevationTier, string> = {
  0: "shadow-elev0",
  1: "shadow-elev1",
  2: "shadow-elev2",
  3: "shadow-elev3",
};

/** Border brightness multiplier (1.0 = default). */
export const ELEVATION_BORDER_BRIGHTNESS: Record<ElevationTier, number> = {
  0: 0.6,
  1: 1.0,
  2: 1.3,
  3: 1.6,
};

/** Relative z-index offset per tier. */
export const ELEVATION_Z: Record<ElevationTier, number> = {
  0: 0,
  1: 1,
  2: 10,
  3: 50,
};

export function getElevationClass(tier: ElevationTier): string {
  return ELEVATION_CLASS[tier];
}

export function getElevationZ(tier: ElevationTier): number {
  return ELEVATION_Z[tier];
}
