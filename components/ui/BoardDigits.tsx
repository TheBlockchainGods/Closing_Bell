"use client";

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/cn";
import { EASE_BELL } from "@/lib/motion";

type BoardSize = "sm" | "md" | "lg";

const CELL: Record<BoardSize, string> = {
  sm: "h-9 w-6 text-[1.05rem]",
  md: "h-14 w-10 text-[1.9rem] sm:h-16 sm:w-11 sm:text-[2.2rem]",
  lg: "h-[3.5rem] w-[2.3rem] text-[2.3rem] sm:h-[4.8rem] sm:w-[3.2rem] sm:text-[3.2rem] md:h-24 md:w-16 md:text-[4rem]",
};

function Digit({
  char,
  size,
  dim,
}: {
  char: string;
  size: BoardSize;
  dim?: boolean;
}) {
  return (
    <span
      className={cn(
        "digit-cell relative overflow-hidden font-mono font-semibold tabular-nums",
        dim ? "text-ink-3" : "text-brass-100",
        CELL[size],
      )}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={char}
          className="absolute inset-0 grid place-items-center"
          initial={{ y: "-100%", opacity: 0.2 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "100%", opacity: 0.2 }}
          transition={{ duration: 0.34, ease: EASE_BELL }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface BoardGroupProps {
  value: string;
  label: string;
  size?: BoardSize;
  dim?: boolean;
}

/** One labelled group of digits, like a single field on a departures board. */
export function BoardGroup({
  value,
  label,
  size = "md",
  dim,
}: BoardGroupProps) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="flex gap-1">
        {value.split("").map((char, index) => (
          <Digit key={index} char={char} size={size} dim={dim} />
        ))}
      </span>
      <span
        className={cn(
          "font-mono text-[0.6rem] font-medium uppercase tracking-[0.24em]",
          dim ? "text-ink-3" : "text-brass-500",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function BoardSeparator({ dim }: { dim?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mb-6 self-center font-mono text-[1.1rem] leading-none sm:mb-7 sm:text-[1.4rem]",
        dim ? "text-ink-3" : "text-brass-600",
      )}
    >
      :
    </span>
  );
}
