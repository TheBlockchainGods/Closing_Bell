import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "signal";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2.5 " +
  "whitespace-nowrap font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] " +
  "transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: cn(
    "rounded-sm border border-brass-200/80 text-floor-1000",
    "bg-[linear-gradient(174deg,var(--color-brass-50)_0%,var(--color-brass-200)_42%,var(--color-brass-400)_100%)]",
    "shadow-[0_10px_30px_-14px_rgba(212,160,23,0.75)]",
    "hover:brightness-110 hover:shadow-[0_14px_38px_-14px_rgba(212,160,23,0.9)]",
  ),
  secondary: cn(
    "rounded-sm border border-line-strong bg-floor-900/80 text-ink",
    "hover:border-tape/55 hover:bg-floor-800 hover:text-tape",
  ),
  ghost: cn(
    "rounded-sm border border-transparent text-ink-2",
    "hover:border-line-strong hover:bg-floor-900 hover:text-ink",
  ),
  signal: cn(
    "rounded-sm border border-ember-500/70 bg-ember-500/12 text-ember-300",
    "hover:border-ember-400 hover:bg-ember-500/22 hover:text-ember-300",
    "shadow-[0_10px_30px_-16px_rgba(206,17,38,0.8)]",
  ),
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5",
  md: "h-11 px-5",
  lg: "h-13 px-7 text-[0.78rem]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </a>
  );
}
