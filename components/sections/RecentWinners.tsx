"use client";

import { motion } from "framer-motion";

import { Section } from "@/components/ui/Section";
import { useBell } from "@/lib/bell-store";
import { cn } from "@/lib/cn";
import {
  formatEtStamp,
  formatGme,
  formatGmeWhole,
  formatPct,
  shortAddress,
} from "@/lib/format";
import { BELL_LABEL } from "@/lib/market-clock";
import type { WinnerRecord } from "@/lib/types";

const KIND_TONE: Record<string, string> = {
  open: "text-tape",
  lunch: "text-brass-300",
  close: "text-ember-400",
};

/** Shared entry animation: a new ring flashes ember, then settles. */
const flashIn = {
  initial: { backgroundColor: "rgba(255,74,28,0.16)" },
  animate: { backgroundColor: "rgba(255,74,28,0)" },
  transition: { duration: 1.4, ease: "easeOut" },
} as const;

function KindLabel({ winner }: { winner: WinnerRecord }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em]",
        KIND_TONE[winner.kind],
      )}
    >
      {BELL_LABEL[winner.kind]}
    </span>
  );
}

function Stamp({ winner }: { winner: WinnerRecord }) {
  return (
    <span className="whitespace-nowrap font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-3">
      {formatEtStamp(winner.ringedAt)}
      {winner.simulated ? " \u00b7 simulated" : ""}
    </span>
  );
}

function Paid({ winner }: { winner: WinnerRecord }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-display text-[1.05rem] font-bold tabular-nums text-brass-100">
        {formatGme(winner.amountGme)}
      </span>
      <span className="ml-1.5 font-mono text-[0.62rem] text-ink-3">GME</span>
    </span>
  );
}

export function RecentWinners() {
  const bell = useBell();
  const total = bell.winners.reduce((sum, winner) => sum + winner.amountGme, 0);

  return (
    <Section
      id="winners"
      index="08"
      eyebrow="Recent winners"
      title="Every ring, on the record"
      lead="One wallet per bell, paid in GME, published as it settles. Tickets reset for everyone the moment a ring clears."
      aside={
        <div className="rounded-xs border border-line bg-floor-900 px-4 py-3">
          <p className="label-mono">Paid across last six rings</p>
          <p className="mt-1.5 font-display text-[1.3rem] font-bold tabular-nums text-brass-200">
            {formatGme(total)}
            <span className="ml-1.5 font-mono text-[0.65rem] text-ink-3">
              GME
            </span>
          </p>
        </div>
      }
    >
      <div className="panel overflow-hidden">
        {/* Stacked rows for narrow screens */}
        <ul className="sm:hidden">
          {bell.winners.map((winner) => (
            <motion.li
              key={winner.id}
              className="border-b border-line px-5 py-4 last:border-b-0"
              {...flashIn}
            >
              <div className="flex items-baseline justify-between gap-3">
                <KindLabel winner={winner} />
                <Paid winner={winner} />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span className="font-mono text-[0.76rem] text-ink">
                  {shortAddress(winner.address)}
                </span>
                <Stamp winner={winner} />
              </div>
              <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-3">
                {formatGmeWhole(winner.ticketsAtRing)} tickets at{" "}
                {formatPct(winner.oddsAtRing)}
              </p>
            </motion.li>
          ))}
        </ul>

        {/* Full table from small screens up */}
        <table className="hidden w-full border-collapse text-left sm:table">
          <caption className="sr-only">
            The six most recent Bell Pot payouts
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="label-mono px-5 py-3.5 font-medium sm:px-6">
                Bell
              </th>
              <th scope="col" className="label-mono px-5 py-3.5 font-medium sm:px-6">
                Wallet
              </th>
              <th
                scope="col"
                className="label-mono px-5 py-3.5 text-right font-medium sm:px-6"
              >
                Tickets
              </th>
              <th
                scope="col"
                className="label-mono hidden px-5 py-3.5 text-right font-medium md:table-cell md:px-6"
              >
                Odds
              </th>
              <th
                scope="col"
                className="label-mono px-5 py-3.5 text-right font-medium sm:px-6"
              >
                Paid
              </th>
            </tr>
          </thead>
          <tbody>
            {bell.winners.map((winner) => (
              <motion.tr
                key={winner.id}
                className="border-b border-line last:border-b-0"
                {...flashIn}
              >
                <td className="px-5 py-4 sm:px-6">
                  <KindLabel winner={winner} />
                  <span className="mt-1 block">
                    <Stamp winner={winner} />
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-[0.8rem] text-ink sm:px-6">
                  {shortAddress(winner.address)}
                </td>
                <td className="px-5 py-4 text-right font-mono text-[0.8rem] tabular-nums text-ink-2 sm:px-6">
                  {formatGmeWhole(winner.ticketsAtRing)}
                </td>
                <td className="hidden px-5 py-4 text-right font-mono text-[0.8rem] tabular-nums text-ink-2 md:table-cell md:px-6">
                  {formatPct(winner.oddsAtRing)}
                </td>
                <td className="px-5 py-4 text-right sm:px-6">
                  <Paid winner={winner} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
