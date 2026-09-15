"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useHydrated } from "@/lib/use-clock";

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  /** Spring feel. "pot" is heavy and deliberate, "row" is quick. */
  feel?: "pot" | "row";
}

const SPRINGS = {
  pot: { stiffness: 64, damping: 24, mass: 1.1 },
  row: { stiffness: 150, damping: 26, mass: 0.5 },
} as const;

/**
 * A number that travels to its new value instead of jumping.
 * Renders plain text until mounted so hydration always matches.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  feel = "row",
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const hydrated = useHydrated();
  const spring = useSpring(value, SPRINGS[feel]);
  const text = useTransform(spring, (current) => format(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  if (!hydrated || reduceMotion) {
    return <span className={className}>{format(value)}</span>;
  }

  return <motion.span className={className}>{text}</motion.span>;
}
