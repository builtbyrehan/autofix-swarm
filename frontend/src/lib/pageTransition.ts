import type { Variants } from "framer-motion";
import { EASE, DURATION } from "./easing";

/** Shared page transition variants — fade + subtle scale + vertical shift. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.base, ease: EASE.primary, staggerChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: DURATION.fast, ease: EASE.exit },
  },
};

/** For items that slide in from below (sections, panels). */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** For items that fade in with scale (pipeline visualization, hero graphic). */
export const fadeScale: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

/**
 * page3D — 3D-aware page transition with subtle rotateY + translateZ.
 * Used by RouteTransition. The container needs perspective: 1200px.
 * Honors prefers-reduced-motion via CSS override (kills transform).
 */
export const page3D: Variants = {
  initial: { opacity: 0, rotateY: -4, translateZ: -60 },
  animate: {
    opacity: 1,
    rotateY: 0,
    translateZ: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    rotateY: 4,
    translateZ: -40,
    transition: { duration: 0.25, ease: [0.45, 0, 0.55, 1] },
  },
};
