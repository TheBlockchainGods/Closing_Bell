"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { EASE_BELL } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  as?: "div" | "li" | "section";
}

/**
 * Scroll-in reveal. The y offset is a transform, so `MotionRoot` removes it
 * under `prefers-reduced-motion` and leaves a plain fade.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 20,
  as = "div",
}: RevealProps) {
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -8% 0px" }}
      transition={{ duration: 0.7, ease: EASE_BELL, delay }}
    >
      {children}
    </Component>
  );
}
