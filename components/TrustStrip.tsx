"use client";

import { useBell } from "@/lib/bell-store";
import { formatCountdownClock } from "@/lib/market-clock";
import { formatGme, formatUsd } from "@/lib/format";
import { useBellClock } from "@/lib/use-clock";

/**
 * Above-the-fold trust strip under the nav.
 * Lives next to the full Bell Pot and Countdown sections further down; it does
 * not replace them. Decorative for AT because the same figures are elsewhere.
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
    <div
      aria-hidden="true"
      className="relative z-20 border-b border-line bg-floor-1000"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <StripCell
          label="Jackpot"
          primary={jackpotPrimary}
          secondary={
            bell.feedStatus === "live" ? formatUsd(jackpotUsd) : "From the API"
          }
          live={bell.feedStatus === "live"}
        />
        <StripCell
          label="Next bell"
          primary={countdown}
          secondary={nextLabel}
        />
        <StripCell
          label="Total paid out"
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
    <div className="flex min-w-0 items-baseline gap-3 px-5 py-2.5 sm:px-6 sm:py-3">
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-brass-500">
        {live ? (
          <span
            className="size-1.5 rounded-full bg-tape shadow-[0_0_8px_rgba(0,200,5,0.7)]"
            aria-hidden="true"
          />
        ) : null}
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[0.72rem] font-semibold tabular-nums tracking-[0.04em] ${
          live ? "text-brass-200" : "text-ink"
        }`}
      >
        {primary}
      </span>
      <span className="ml-auto hidden shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-3 sm:inline">
        {secondary}
      </span>
    </div>
  );
}
