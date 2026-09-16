/**
 * Domain types for Closing Bell.
 *
 * Pot, odds, ladder, and winners are filled from the live API via
 * `lib/bell-store.tsx`. Copy and After Hours targets still live in
 * `lib/mock-data.ts`.
 */

export type BellKind = "open" | "lunch" | "close";

export interface BellDefinition {
  kind: BellKind;
  /** Display name, e.g. "Close Bell". */
  label: string;
  /** Hour in America/New_York, 24h. */
  hourEt: number;
  /** Minute in America/New_York. */
  minuteEt: number;
  /** One line explaining what this bell does. */
  note: string;
}

export interface BellOccurrence extends BellDefinition {
  /** Absolute instant of the next occurrence. */
  at: Date;
  /**
   * True when this bell is the first ring after a non-trading gap, so the pot
   * it pays includes everything that accrued across the weekend.
   */
  carriesWeekend: boolean;
}

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export interface PotSnapshot {
  /** GME already committed to the pot and payable on the next ring. */
  inPotGme: number;
  /** Fees earned but not yet swept into the pot. */
  accruingGme: number;
  /** GME price used for the USD readout (from the API). */
  gmePriceUsd: number;
  /** All-time GME paid out across settled rings. */
  totalPaidOutGme: number;
}

export interface MarketSnapshot {
  bellPriceUsd: number;
  marketCapUsd: number;
  windowVolumeGme: number;
  holders: number;
  /** Bell tickets outstanding across all wallets in the current window. */
  totalTickets: number;
  /** Hard cap on a single wallet's win probability, as a fraction. */
  oddsCap: number;
}

/**
 * The wallet behind the connect shortcut. Only what the shortcut needs: enough
 * to resolve a position, since the page reads addresses rather than holding one.
 */
export interface WalletSnapshot {
  address: string;
  /** Bell tickets at the reference window size, used to derive a share. */
  tickets: number;
}

export interface WinnerRecord {
  id: string;
  address: string;
  kind: BellKind;
  amountGme: number;
  ticketsAtRing: number;
  oddsAtRing: number;
  /** ISO instant. Formatted in ET so server and client always agree. */
  ringedAt: string;
  /** True for rings produced by the on-page demo control. */
  simulated?: boolean;
  /** True when this pot included weekend accrual, so a Monday Open Bell. */
  carriedWeekend?: boolean;
}

export interface AfterHoursSnapshot {
  /**
   * Whether staking is actually running. While this is "coming-soon" every
   * figure below is an illustrative target, not a vault balance, and the UI
   * must say so and keep the controls disabled.
   */
  status: "live" | "coming-soon";
  /** Illustrative target for total $BELL staked. */
  totalStakedBell: number;
  /** Illustrative target for the weekly pot, denominated in GME. */
  weeklyPotGme: number;
  /** Share of $BELL supply the design assumes is staked, as a fraction. */
  targetStakedShare: number;
}

export interface HowStep {
  index: number;
  title: string;
  kicker: string;
  body: string;
  rule: string;
}

export interface LockedRule {
  id: string;
  title: string;
  body: string;
}

export interface TickerStanding {
  address: string;
  /**
   * Tickets at the reference window size, used only to derive a share. The
   * ladder scales from the share, so it stays consistent when the window resets
   * to zero after a ring.
   */
  tickets: number;
}

/** One row of the ticket ladder, after the per-wallet cap is applied. */
export interface LadderRow {
  rank: number;
  address: string;
  /** Tickets at the current window size. */
  tickets: number;
  /** GME spent on $BELL in this window, across every trade route. */
  spentInWindowGme: number;
  /** Share of all tickets out, before the cap. */
  share: number;
  /** Win probability after the cap, as a fraction. */
  odds: number;
  /** True when the cap is what is limiting this wallet's odds. */
  capped: boolean;
  /** True when this row is the address the visitor looked up. */
  isYou: boolean;
}

/** Result of looking up an arbitrary address against the live ticket bag. */
export interface WalletLookup {
  address: string;
  /** Share of all tickets out, before the cap. */
  share: number;
  /** True when the address is one of the seeded ladder wallets. */
  onLadder: boolean;
}
