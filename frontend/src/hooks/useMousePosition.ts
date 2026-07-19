"use client";

import { useEffect, useRef } from "react";

export interface MousePosition {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
}

const DEFAULT: MousePosition = { x: -999, y: -999, normalizedX: 0.5, normalizedY: 0.5 };

/**
 * Tracks cursor position. Returns a ref object so the value is always
 * current without causing re-renders (use for effects/animations).
 *
 * Call `.get()` to read the latest position synchronously.
 */
export function useMousePosition() {
  const pos = useRef<MousePosition>(DEFAULT);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      pos.current = {
        x: e.clientX,
        y: e.clientY,
        normalizedX: e.clientX / window.innerWidth,
        normalizedY: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return pos;
}
