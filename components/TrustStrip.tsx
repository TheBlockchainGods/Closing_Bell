"use client";

import { useBell } from "@/lib/bell-store";
import { formatCountdownClock } from "@/lib/market-clock";
import { formatGme, formatUsd } from "@/lib/format";
import { useBellClock } from "@/lib/use-clock";

/**
 * Slim jackpot / next / paid tape on the first fold.
 * Decorative for AT because the same figures live in Bell Pot and Countdown.
 */
export function TrustStrip() {
  const bell = useBell();
  const clock = useBellClock(1);
  const jackpotUsd = bell.potTotalGme * bell.gmePriceUsd;
  const paidUsd = bell.totalPaidOutGme * bell.gmePriceUsd;
  const countdown = formatCountdownClock(clock.remaining);
  const nextLabel = clock.next?.label ?? "Next bell";
  const jackpotPrimary =
    bell.feedStatus === "loading"
      ? "Reading"
      : bell.feedStatus === "offline"
        ? "Unreachable"
        : `${formatGme(bell.potTotalGme)} GME`;
  const paidPrimary =
    bell.feedStatus === "loading"
      ? "Reading"
      : bell.feedStatus === "offline"
        ? "Unreachable"
        : `${formatGme(bell.totalPaidOutGme)} GME`;

  return (
    <div aria-hidden="true" className="relative z-20">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-3 divide-x divide-line/70">
        <StripCell
          label="Jackpot"
          primary={jackpotPrimary}
          secondary={
            bell.feedStatus === "live" ? formatUsd(jackpotUsd) : "From the API"
          }
          live={bell.feedStatus === "live"}
        />
        <StripCell
          label="Next"
          primary={countdown}
          secondary={nextLabel}
        />
        <StripCell
          label="Paid"
          primary={paidPrimary}
          secondary={
            bell.feedStatus === "live" ? formatUsd(paidUsd) : "From the API"
          }
        />
      </div>
    </div>
  );
}

function StripCell({
  label,
  primary,
  secondary,
  live,
}: {
  label: string;
  primary: string;
  secondary: string;
  live?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-3 sm:px-6 sm:py-2">
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-brass-400 sm:text-[0.58rem] sm:tracking-[0.18em]">
        {live ? (
          <span
            className="size-1.5 rounded-full bg-tape shadow-[0_0_8px_rgba(0,200,5,0.7)]"
            aria-hidden="true"
          />
        ) : null}
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[0.62rem] font-semibold tabular-nums tracking-[0.04em] sm:text-[0.72rem] ${
          live ? "text-brass-200" : "text-ink"
        }`}
      >
        {primary}
      </span>
      <span className="hidden min-w-0 truncate font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-3 lg:ml-auto lg:inline">
        {secondary}
      </span>
    </div>
  );
}
