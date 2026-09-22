"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CopyableAddress, PayoutTxLink } from "@/components/ui/CopyableAddress";
import { ShareJackpotModal } from "@/components/bell-pot/ShareJackpotModal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useBell } from "@/lib/bell-store";
import {
  formatEtStamp,
  formatGme,
  formatGmePaid,
  formatGmeWhole,
  formatPct,
  formatUsd,
  formatUsdPrecise,
} from "@/lib/format";
import { BELL_LABEL } from "@/lib/market-clock";
import { EASE_BELL } from "@/lib/motion";

function LivePill({
  status,
  fixtureMode,
}: {
  status: "loading" | "live" | "offline";
  fixtureMode: boolean;
}) {
  const live = status === "live";
  const label =
    status === "loading"
      ? "Reading the pot"
      : status === "offline"
        ? "API unreachable"
        : fixtureMode
          ? "Fixture feed"
          : "Pot updating live";

  return (
    <span className="inline-flex items-center gap-2 rounded-xs border border-brass-700/60 bg-brass-500/8 px-3 py-2">
      <span className="relative flex size-1.5" aria-hidden="true">
        {live ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-tape/70" />
        ) : null}
        <span
          className={`relative size-1.5 rounded-full ${
            live ? "bg-tape" : status === "offline" ? "bg-ember-400" : "bg-brass-500"
          }`}
        />
      </span>
      <span className="font-mono text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-brass-200">
        {label}
      </span>
    </span>
  );
}

function SplitBar({ inPot, accruing }: { inPot: number; accruing: number }) {
  const total = Math.max(inPot + accruing, 0.0001);
  const inPotPct = (inPot / total) * 100;

  return (
    <div className="h-2 w-full overflow-hidden rounded-xs bg-floor-800">
      <motion.div
        className="h-full bg-[linear-gradient(90deg,var(--color-brass-500),var(--color-brass-200))]"
        animate={{ width: `${inPotPct}%` }}
        transition={{ duration: 0.8, ease: EASE_BELL }}
        style={{ width: `${inPotPct}%` }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="bg-floor-900 px-5 py-5 sm:px-6">
      <p className="label-mono">{label}</p>
      <p className="mt-2 font-display text-[1.35rem] font-bold tabular-nums text-ink">
        {value}
      </p>
      {note ? (
        <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-3">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function BellPot() {
  const bell = useBell();
  const winner = bell.lastWinner;
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSession, setShareSession] = useState(0);
  const potUsd = bell.potTotalGme * bell.gmePriceUsd;

  return (
    <Section
      id="bell-pot"
      index="02"
      eyebrow="Live Bell Pot"
      title="The pot, live and in the open"
      lead="Every buy on the GME pair routes a slice into the Bell Pot, wherever you trade. It sits in the open, climbing, until the public formula picks one wallet from the locked ticket list."
      aside={
        <LivePill status={bell.feedStatus} fixtureMode={bell.fixtureMode} />
      }
    >
      <div className="panel shadow-panel overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="border-b border-line px-5 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="label-mono">Payable on the next ring</p>
              <Button
                variant="tape"
                size="sm"
                onClick={() => {
                  setShareSession((n) => n + 1);
                  setShareOpen(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={shareOpen}
              >
                Share
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
              <AnimatedNumber
                value={bell.potTotalGme}
                format={formatGme}
                feel="pot"
                className="brass-text font-display type-expanded text-[clamp(3.2rem,10.5vw,7rem)] font-extrabold leading-[0.8] tracking-[-0.03em] tabular-nums"
              />
              <span className="mb-2 font-mono text-base font-semibold tracking-[0.14em] text-brass-400">
                GME
              </span>
            </div>
            <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-ink-2">
              <AnimatedNumber
                value={potUsd}
                format={formatUsd}
                feel="pot"
                className="font-display text-[1.6rem] font-bold tabular-nums text-ink"
              />
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink-3">
                at{" "}
                <AnimatedNumber
                  value={bell.gmePriceUsd}
                  format={formatUsdPrecise}
                  className="tabular-nums text-ink-2"
                />{" "}
                per GME
              </span>
            </p>
          </div>

          <div className="flex flex-col justify-center gap-6 px-5 py-8 sm:px-8">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brass-200">
                  In pot
                </p>
                <p className="font-display text-[1.15rem] font-bold tabular-nums text-ink">
                  <AnimatedNumber value={bell.inPotGme} format={formatGme} />
                  <span className="ml-1.5 font-mono text-[0.66rem] text-ink-3">
                    GME
                  </span>
                </p>
              </div>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-3">
                Swept and locked. This is what the winner receives.
              </p>
            </div>

            <SplitBar inPot={bell.inPotGme} accruing={bell.accruingGme} />

            <div>
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brass-500">
                  Accruing (unclaimed)
                </p>
                <p className="font-display text-[1.15rem] font-bold tabular-nums text-ink-2">
                  <AnimatedNumber value={bell.accruingGme} format={formatGme} />
                  <span className="ml-1.5 font-mono text-[0.66rem] text-ink-3">
                    GME
                  </span>
                </p>
              </div>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-3">
                Fees taken this window, not yet swept. They sweep in before the
                bell, so they pay out too.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Metric
            label="Window volume"
            value={
              <>
                <AnimatedNumber
                  value={bell.windowVolumeGme}
                  format={formatGmeWhole}
                />
                <span className="ml-1.5 font-mono text-[0.66rem] text-ink-3">
                  GME
                </span>
              </>
            }
          />
          <Metric
            label="Tickets out"
            value={
              <AnimatedNumber
                value={bell.totalTickets}
                format={formatGmeWhole}
              />
            }
            note="All wallets, this window"
          />
          <Metric
            label="Total paid out"
            value={
              <>
                <AnimatedNumber
                  value={bell.totalPaidOutGme}
                  format={formatGme}
                />
                <span className="ml-1.5 font-mono text-[0.66rem] text-ink-3">
                  GME
                </span>
              </>
            }
            note="All-time, all rings"
          />
          <Metric
            label="Odds cap"
            value={formatPct(bell.oddsCap, 2)}
            note="Max weight vs live bag"
          />
        </div>
      </div>

      <p className="mt-5 max-w-2xl text-[0.88rem] leading-relaxed text-ink-3">
        About a 4% PONS creator tax; half of claimed fees go to the jackpot.
        Odds move until the bag locks. The odds cap ({formatPct(bell.oddsCap)})
        is max draw weight share vs the live ticket bag, not a locked win chance
        for the rest of the window.
      </p>

      <AnimatePresence initial={false}>
        {winner ? (
          <motion.div
            key={winner.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE_BELL }}
            className="mt-4 overflow-hidden rounded-sm border border-ember-500/40 bg-[linear-gradient(100deg,rgba(255,74,28,0.12),rgba(18,16,12,0.9))]"
          >
            <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="font-mono text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-ember-300">
                  {BELL_LABEL[winner.kind]} rung
                </p>
                <p className="mt-2 font-display type-expanded text-[1.5rem] font-extrabold uppercase leading-tight text-ink">
                  {formatGmePaid(winner.amountGme)} GME
                </p>
                <CopyableAddress className="mt-2" address={winner.address} />
                <PayoutTxLink className="mt-2" txHash={winner.txHash} />
                <p className="mt-2 text-[0.85rem] text-ink-2">
                  Held {formatGmeWhole(winner.ticketsAtRing)} tickets at{" "}
                  {formatPct(winner.oddsAtRing)} odds. Every Bell ticket has
                  been wiped and the window restarts flat.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={bell.dismissRing}>
                Dismiss
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {bell.winners[0] ? (
        <div className="mt-5 flex max-w-2xl flex-col gap-2">
          <p className="text-[0.85rem] leading-relaxed text-ink-3">
            Last ring paid {formatGmePaid(bell.winners[0].amountGme)} GME on{" "}
            {formatEtStamp(bell.winners[0].ringedAt)}.
          </p>
          <PayoutTxLink txHash={bell.winners[0].txHash} />
        </div>
      ) : null}

      <ShareJackpotModal
        key={shareSession}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        displayPotGme={bell.potTotalGme}
        displayPotUsd={potUsd}
        inPotGme={bell.inPotGme}
        accruingGme={bell.accruingGme}
        totalPaidOutGme={bell.totalPaidOutGme}
        totalPaidOutUsd={bell.totalPaidOutGme * bell.gmePriceUsd}
      />
    </Section>
  );
}
