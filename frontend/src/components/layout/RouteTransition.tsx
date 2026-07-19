"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { page3D } from "@/lib/pageTransition";

/**
 * RouteTransition — wraps page content with AnimatePresence so every
 * route change gets a 3D rotateY/translateZ transition. Keyed on pathname.
 * Container uses perspective for child 3D transforms to feel like a
 * cockpit window rotating between mission views.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={page3D}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ perspective: 1200 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
