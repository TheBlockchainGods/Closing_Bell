import { cn } from "@/lib/cn";

export function BellGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.2 17.2c0-3.4 2-4.6 2.3-8 .2-1.6 1.2-2.4 3.5-2.4h4c2.3 0 3.3.8 3.5 2.4.3 3.4 2.3 4.6 2.3 8z"
        fill="currentColor"
      />
      <path
        d="M3 17.4h18v2.1H3z"
        fill="currentColor"
        opacity="0.75"
      />
      <path
        d="M10.1 6.2a1.9 1.9 0 1 1 3.8 0z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="12" cy="21.4" r="1.7" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({
  className,
  withTicker = true,
}: {
  className?: string;
  withTicker?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BellGlyph className="size-5 text-brass-300" />
      <span className="whitespace-nowrap font-display type-expanded text-[0.88rem] font-extrabold uppercase leading-none tracking-[0.05em] text-ink sm:text-[0.95rem]">
        Closing Bell
      </span>
      {withTicker ? (
        <span className="ml-0.5 hidden rounded-xs border border-brass-700/70 bg-brass-500/10 px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold leading-none tracking-[0.1em] text-brass-200 min-[400px]:inline">
          $BELL
        </span>
      ) : null}
    </span>
  );
}
