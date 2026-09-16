"use client";

import { AddressInput } from "@/components/ui/AddressInput";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useBell } from "@/lib/bell-store";
import { cn } from "@/lib/cn";
import {
  formatGme,
  formatGmeWhole,
  formatPct,
  shortAddress,
} from "@/lib/format";
import {
  bagLockAt,
  formatCountdownClock,
  remainingUntil,
} from "@/lib/market-clock";
import { PONS_URL, isAddressLike } from "@/lib/mock-data";
import { EASE_BELL } from "@/lib/motion";
import { useBellClock, useNow } from "@/lib/use-clock";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

function OddsDial({
  odds,
  cap,
  muted,
}: {
  odds: number;
  cap: number;
  muted?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const fill = cap > 0 ? Math.min(1, odds / cap) : 0;
  const radius = 74;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn(
        "relative grid size-[190px] shrink-0 place-items-center transition-opacity duration-300",
        muted && "opacity-45",
      )}
    >
      <svg viewBox="0 0 180 180" className="size-full -rotate-90">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="var(--color-floor-800)"
          strokeWidth="10"
        />
        <motion.circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="url(#odds-arc)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - fill) }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.9, ease: EASE_BELL }
          }
        />
        <defs>
          <linearGradient id="odds-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brass-500)" />
            <stop offset="100%" stopColor="var(--color-brass-100)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <AnimatedNumber
          value={odds}
          format={(value) => formatPct(value)}
          className="font-display type-expanded text-[2.1rem] font-extrabold tabular-nums text-ink"
        />
        <span className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-ink-3">
          Your odds now
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <span className="label-mono">{label}</span>
      <span className="font-display text-[1.02rem] font-bold tabular-nums text-ink">
        {value}
      </span>
    </div>
  );
}

function TicketLadder() {
  const bell = useBell();

  return (
    <div className="panel-quiet overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <h3 className="font-display type-expanded text-[1.05rem] font-extrabold uppercase tracking-[0.02em] text-ink">
          Ticket ladder, this window
        </h3>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
          {formatGmeWhole(bell.totalTickets)} tickets out
        </p>
      </div>

      <ul className="divide-y divide-line">
        {bell.ladder.length === 0 ? (
          <li className="px-5 py-6 text-[0.88rem] leading-relaxed text-ink-2 sm:px-6">
            {bell.feedStatus === "loading"
              ? "Reading the ticket ladder from the API."
              : bell.feedStatus === "offline"
                ? "Could not reach the ladder feed."
                : "No tickets in this window yet. Buys on the GME pair mint them."}
          </li>
        ) : null}
        {bell.ladder.map((row) => (
          <li
            key={row.address}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5 sm:gap-5 sm:px-6",
              row.isYou && "bg-brass-500/8",
            )}
          >
            <span
              className={cn(
                "w-6 shrink-0 font-mono text-[0.7rem] font-semibold tabular-nums",
                row.isYou ? "text-brass-200" : "text-ink-3",
              )}
            >
              {row.rank}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-mono text-[0.78rem] font-medium",
                  row.isYou ? "text-brass-100" : "text-ink-2",
                )}
              >
                {shortAddress(row.address)}
              </span>
              {row.isYou ? (
                <span className="mt-0.5 block font-mono text-[0.56rem] uppercase tracking-[0.2em] text-brass-400">
                  Looked up
                </span>
              ) : null}
            </span>

            <span className="hidden w-24 shrink-0 text-right font-display text-[0.92rem] font-bold tabular-nums text-ink-2 sm:block">
              {formatGmeWhole(row.tickets)}
            </span>

            <span className="w-20 shrink-0 text-right">
              <span className="block font-display text-[0.98rem] font-bold tabular-nums text-ink">
                {formatPct(row.odds)}
              </span>
              {row.capped ? (
                <span className="block font-mono text-[0.54rem] uppercase tracking-[0.18em] text-ember-400">
                  At cap
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-line px-5 py-4 text-[0.82rem] leading-relaxed text-ink-3 sm:px-6">
        At odds cap means this wallet already holds the max draw weight share vs
        the live ticket bag ({formatPct(bell.oddsCap)}). The cap exists so one
        wallet cannot own the bell. Extra weight past the cap is simply not
        counted. Odds still move until bag lock.
      </p>
    </div>
  );
}

function AdvancedSwap() {
  return (
    <details className="group mt-4 rounded-sm border border-line bg-floor-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm px-5 py-4 transition-colors hover:bg-floor-850 focus-visible:bg-floor-850 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-display text-[0.98rem] font-bold text-ink">
            Advanced: buy through this page
          </span>
          <span className="mt-1 block text-[0.82rem] leading-relaxed text-ink-3">
            Optional. Buying here is not required to earn tickets.
          </span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 font-mono text-[0.7rem] text-brass-400 transition-transform duration-200 group-open:rotate-180"
        >
          &#9660;
        </span>
      </summary>

      <div className="border-t border-line px-5 py-5 sm:px-6">
        <p className="max-w-2xl text-[0.88rem] leading-relaxed text-ink-2">
          Most holders will never use this. Tickets are minted by the on-chain
          buy itself, so a bot, a terminal, an aggregator or a router all mint
          exactly the same weight as a swap started here. This route exists for
          convenience, not for eligibility.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ButtonLink
            href={PONS_URL}
            variant="secondary"
            rel="noreferrer noopener"
            target="_blank"
          >
            Trade on PONS
          </ButtonLink>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
            Opens on PONS in a new tab
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line pt-5 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="label-mono">Tickets per GME spent</dt>
            <dd className="font-display text-[0.98rem] font-bold tabular-nums text-brass-200">
              1,000
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="label-mono">Bell Pot funding</dt>
            <dd className="font-display text-[0.98rem] font-bold text-brass-200">
              Fees fund the pot
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export function YourOdds() {
  const bell = useBell();
  const clock = useBellClock(1);
  const now = useNow();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = draft.trim();
  const valid = isAddressLike(trimmed);
  const error =
    touched && trimmed !== "" && !valid
      ? "That is not a 42-character 0x address"
      : undefined;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    bell.watch(trimmed);
  };

  const watched = bell.watched;
  const mine = bell.myRow;
  const next = clock.next;
  const bagLock = next ? bagLockAt(next.at) : null;
  const bagLockRemaining =
    bagLock && now ? remainingUntil(bagLock, now) : null;
  const bagLocked =
    Boolean(bagLock && now && now.getTime() >= bagLock.getTime());
  const bagLocksLabel = !next
    ? "--"
    : bagLocked
      ? "Locked for this ring"
      : bagLockRemaining
        ? formatCountdownClock(bagLockRemaining)
        : "--";

  return (
    <Section
      id="odds"
      index="04"
      eyebrow="Your odds"
      title="Read any wallet's position"
      lead="Tickets come from on-chain $BELL buys on the GME pair, wherever you trade. Your odds move until the bag locks. Paste an address to read tickets and odds for this window. Nothing is signed and no wallet is required."
    >
      <div className="mb-6 max-w-3xl space-y-2 text-[0.92rem] leading-relaxed text-ink-2">
        <p>Your odds move until the bag locks.</p>
        <p>Buying earlier does not freeze your % until the bell.</p>
        <p>
          The odds cap ({formatPct(bell.oddsCap)}) is max draw weight share vs the live ticket bag. It
          does not lock a {formatPct(bell.oddsCap)} win chance for the rest of the window.
        </p>
        <p>
          What counts is the ticket bag at bag lock (snapshot), which you can{" "}
          <a href="/verify" className="text-brass-200 underline-offset-2 hover:underline">
            verify
          </a>{" "}
          after the ring.
        </p>
      </div>

      <div className="panel shadow-panel overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="border-b border-line px-5 py-7 sm:px-8 lg:border-b-0 lg:border-r">
            <AddressInput
              id="odds-address"
              label="Wallet address"
              value={draft}
              onChange={(value) => {
                setDraft(value);
                setTouched(false);
              }}
              onSubmit={submit}
              error={error}
              helper="Read only."
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={submit}
                disabled={!valid}
                title={
                  valid
                    ? "Read this address's tickets and odds"
                    : "Paste a full 0x address first"
                }
              >
                Check odds
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  bell.connectShortcut();
                  setDraft("");
                  setTouched(false);
                }}
                disabled={bell.sampleLookups.length === 0}
                title={
                  bell.sampleLookups.length === 0
                    ? "No sample wallet until the ladder has tickets"
                    : "Fill a sample wallet address. Nothing is signed."
                }
              >
                Use sample wallet
              </Button>
              {watched ? (
                <Button variant="ghost" size="sm" onClick={bell.clearWatch}>
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="label-mono">Or try a sample address</p>
              {bell.sampleLookups.length === 0 ? (
                <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-3">
                  No sample wallets until the live ladder has tickets.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {bell.sampleLookups.map((address) => (
                    <button
                      key={address}
                      type="button"
                      onClick={() => {
                        setDraft(address);
                        setTouched(false);
                        bell.watch(address);
                      }}
                      className="rounded-xs border border-line-strong px-2.5 py-1.5 font-mono text-[0.66rem] font-medium text-ink-2 transition-colors hover:border-brass-600 hover:bg-brass-500/10 hover:text-brass-100"
                    >
                      {shortAddress(address)}
                    </button>
                  ))}
                </div>
              )}
              {bell.oddsLookupError ? (
                <p className="mt-3 text-[0.82rem] leading-relaxed text-ember-400">
                  {bell.oddsLookupError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 px-5 py-7 sm:px-8">
            <OddsDial
              odds={mine?.odds ?? 0}
              cap={bell.oddsCap}
              muted={!mine}
            />

            <div className="w-full">
              {watched && mine ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="label-mono">
                      {bell.watchedViaConnect ? "Sample wallet" : "Reading"}
                    </p>
                    <p className="font-mono text-[0.78rem] font-semibold text-brass-200">
                      {shortAddress(watched.address)}
                    </p>
                  </div>
                  <div className="mt-4">
                    <Stat
                      label="Your odds now"
                      value={formatPct(mine.odds)}
                    />
                    <Stat
                      label="Your tickets"
                      value={
                        <AnimatedNumber
                          value={mine.tickets}
                          format={formatGmeWhole}
                        />
                      }
                    />
                    <Stat
                      label="At odds cap?"
                      value={mine.capped ? "Yes" : "No"}
                    />
                    <Stat label="Bag locks in…" value={bagLocksLabel} />
                    <Stat
                      label="GME spent this window"
                      value={
                        <AnimatedNumber
                          value={mine.spentInWindowGme}
                          format={formatGme}
                        />
                      }
                    />
                    <Stat label="Ladder rank" value={mine.rank} />
                  </div>
                  {mine.capped ? (
                    <p className="mt-4 rounded-xs border border-ember-500/40 bg-ember-500/8 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2">
                      This wallet is at the odds cap ({formatPct(bell.oddsCap)}
                      ): max draw weight share vs the live bag. Raw share is{" "}
                      {formatPct(mine.share)}. Spending more mints more $BELL but
                      adds no draw weight. That still is not a locked win chance
                      until bag lock.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="label-mono">No address yet</p>
                  <p className="mt-3 font-display type-expanded text-[1.3rem] font-extrabold uppercase leading-[1.1] text-ink">
                    Paste an address to read its odds
                  </p>
                  <div className="mt-4">
                    <Stat label="Bag locks in…" value={bagLocksLabel} />
                  </div>
                  <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-2">
                    The ladder below updates with the live ticket bag. You do not
                    need a wallet to read it.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <TicketLadder />
      </div>

      <p className="mt-6 max-w-2xl text-[0.9rem] leading-relaxed text-ink-2">
        Selling burns tickets pro-rata. Sell half your $BELL and half your Bell
        tickets are destroyed in the same transaction, so the ladder reorders in
        the same block.
      </p>

      <AdvancedSwap />
    </Section>
  );
}
