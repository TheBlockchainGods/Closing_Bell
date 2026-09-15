"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * `reducedMotion="user"` makes Framer Motion drop transform and layout
 * animations whenever the visitor asks for reduced motion, while opacity and
 * colour transitions still run. Handling it here rather than branching inside
 * components keeps the server and client markup identical.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
