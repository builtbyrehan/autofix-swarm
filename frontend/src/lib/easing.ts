/**
 * Shared easing constants — one source of truth for motion feel across
 * framer-motion and GSAP. Using these everywhere keeps the product feeling
 * like a single system instead of per-component hand-rolled motion.
 *
 * Primary curve is ease-out-expo family: confident, settles cleanly.
 * The springier curve is reserved for confirmation/success moments only.
 */

// CSS cubic-bezier form (used in stylesheets + framer-motion transitions)
export const EASE = {
  // Primary — use everywhere by default
  primary: [0.16, 1, 0.3, 1] as const, // ease-out-expo
  // Confirmation moments — button presses, node completion, success bursts
  springy: [0.34, 1.56, 0.64, 1] as const, // ease-out-back (subtle overshoot)
  // Entrances from off-screen — slightly slower start than primary
  entrance: [0, 0.55, 0.45, 1] as const,
  // Exits — slightly faster than entrance so leaves feel snappy
  exit: [0.45, 0, 0.55, 1] as const,
} as const;

/**
 * Type-safe easing tuple for framer-motion. The `as const` on EASE gives
 * readonly number[] which framer-motion v12 rejects; this helper casts
 * to the mutable tuple it expects.
 */
type EasingTuple = [number, number, number, number];
export function ease(
  curve: Readonly<[number, number, number, number]>
): EasingTuple {
  return [...curve] as EasingTuple;
}

// GSAP-compatible ease strings (mirror the cubic-bezier values above)
export const GSAP_EASE = {
  primary: "expo.out",
  springy: "back.out(1.4)",
  entrance: "power3.out",
  exit: "power2.in",
} as const;

// Standard durations (ms) — paired with the easing curves
export const DURATION = {
  micro: 0.15, // hover, press feedback
  fast: 0.25, // toggle, small state change
  base: 0.4, // default for most transitions
  slow: 0.7, // panel mount, large layout shift
  stage: 1.2, // pipeline stage transitions (camera, node activation)
} as const;

// framer-motion transition presets — import these instead of inline objects
export const motion = {
  base: { duration: DURATION.base, ease: EASE.primary },
  fast: { duration: DURATION.fast, ease: EASE.primary },
  slow: { duration: DURATION.slow, ease: EASE.entrance },
  springy: { duration: DURATION.base, ease: EASE.springy },
  stage: { duration: DURATION.stage, ease: EASE.entrance },
} as const;

/* 3D motion presets — perspective + rotateY/translateZ combos for
   RouteTransition and page-level 3D depth shifts */
export const motion3D = {
  page: {
    initial: {
      opacity: 0,
      rotateY: -6,
      translateZ: -60,
    },
    animate: {
      opacity: 1,
      rotateY: 0,
      translateZ: 0,
      transition: { duration: DURATION.base, ease: EASE.primary },
    },
    exit: {
      opacity: 0,
      rotateY: 6,
      translateZ: -40,
      transition: { duration: DURATION.fast, ease: EASE.exit },
    },
  },
  card: {
    rest: { rotateX: 0, rotateY: 0, scale: 1 },
    hover: { rotateX: -2, rotateY: 3, scale: 1.02 },
    tap: { scale: 0.97 },
  },
} as const;

/* Spring presets for card tilt spring-back (Tilt3DCard springbone) */
export const SPRING = {
  tilt: { type: "spring" as const, stiffness: 300, damping: 20, mass: 0.8 },
  gentle: { type: "spring" as const, stiffness: 180, damping: 22 },
} as const;
