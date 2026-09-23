/**
 * Pure ticket math for Closing Bell.
 * All knobs come from the caller (config). No magic numbers here.
 *
 * Odds display shares computeOdds with @closing-bell/fairness (draw path).
 */

import {
  computeOdds as sharedComputeOdds,
  normalizeAddress as sharedNormalizeAddress,
  type OddsResult,
} from "@closing-bell/fairness";

export interface TicketEngineConfig {
  minBuyUsd: number;
  ticketsPerUsd: number;
  oddsCapBps: number;
}

export interface WalletTicketState {
  /** Bell tickets held in the current window. */
  tickets: number;
  /** Tracked $BELL balance used for pro-rata sell burns. */
  bellBalance: number;
  /** GME spent on buys that minted tickets this window. */
  spentGme: number;
  /** USD spent on buys that minted tickets this window. */
  spentUsd: number;
}

export type TicketBook = Map<string, WalletTicketState>;

export function emptyWallet(): WalletTicketState {
  return { tickets: 0, bellBalance: 0, spentGme: 0, spentUsd: 0 };
}

export function normalizeAddress(address: string): string {
  return sharedNormalizeAddress(address);
}

/** `usdSpent = gmeAmount * gmeUsdPrice` */
export function usdSpent(gmeAmount: number, gmeUsdPrice: number): number {
  if (!Number.isFinite(gmeAmount) || !Number.isFinite(gmeUsdPrice)) return 0;
  if (gmeAmount <= 0 || gmeUsdPrice <= 0) return 0;
  return gmeAmount * gmeUsdPrice;
}

/**
 * `tickets = floor(usdSpent * TICKETS_PER_USD)` when usdSpent >= MIN_BUY_USD,
 * otherwise 0.
 */
export function mintTickets(
  usd: number,
  cfg: Pick<TicketEngineConfig, "minBuyUsd" | "ticketsPerUsd">,
): number {
  if (!Number.isFinite(usd) || usd < cfg.minBuyUsd) return 0;
  return Math.floor(usd * cfg.ticketsPerUsd);
}

/** Pro-rata burn: sellFraction = bellSold / bellBalanceBefore. */
export function burnTicketsProRata(
  currentTickets: number,
  bellSold: number,
  bellBalanceBefore: number,
): number {
  if (currentTickets <= 0) return 0;
  if (!(bellSold > 0) || !(bellBalanceBefore > 0)) return 0;
  const fraction = Math.min(1, bellSold / bellBalanceBefore);
  return Math.min(currentTickets, Math.floor(currentTickets * fraction));
}

export function totalTickets(book: TicketBook): number {
  let sum = 0;
  for (const row of book.values()) sum += row.tickets;
  return sum;
}

export function getWallet(book: TicketBook, address: string): WalletTicketState {
  const key = normalizeAddress(address);
  return book.get(key) ?? emptyWallet();
}

export function applyBuy(
  book: TicketBook,
  address: string,
  gmeAmount: number,
  bellReceived: number,
  gmeUsdPrice: number,
  cfg: Pick<TicketEngineConfig, "minBuyUsd" | "ticketsPerUsd">,
): { minted: number; usd: number; wallet: WalletTicketState } {
  const key = normalizeAddress(address);
  const prev = book.get(key) ?? emptyWallet();
  const usd = usdSpent(gmeAmount, gmeUsdPrice);
  const minted = mintTickets(usd, cfg);
  const next: WalletTicketState = {
    tickets: prev.tickets + minted,
    bellBalance: Math.max(0, prev.bellBalance + Math.max(0, bellReceived)),
    spentGme: prev.spentGme + (minted > 0 ? Math.max(0, gmeAmount) : 0),
    spentUsd: prev.spentUsd + (minted > 0 ? usd : 0),
  };
  // Buys below min still update BELL balance so later sells burn correctly.
  if (minted === 0) {
    next.spentGme = prev.spentGme;
    next.spentUsd = prev.spentUsd;
  }
  book.set(key, next);
  return { minted, usd, wallet: next };
}

export function applySell(
  book: TicketBook,
  address: string,
  bellSold: number,
  bellBalanceBefore?: number,
): { burned: number; wallet: WalletTicketState } {
  const key = normalizeAddress(address);
  const prev = book.get(key) ?? emptyWallet();
  const balanceBefore =
    bellBalanceBefore !== undefined && bellBalanceBefore > 0
      ? bellBalanceBefore
      : prev.bellBalance;
  const burned = burnTicketsProRata(prev.tickets, bellSold, balanceBefore);
  const nextBalance = Math.max(
    0,
    (bellBalanceBefore !== undefined ? bellBalanceBefore : prev.bellBalance) -
      Math.max(0, bellSold),
  );
  const next: WalletTicketState = {
    tickets: prev.tickets - burned,
    bellBalance: nextBalance,
    spentGme: prev.spentGme,
    spentUsd: prev.spentUsd,
  };
  if (next.tickets === 0 && next.bellBalance === 0) {
    book.delete(key);
  } else {
    book.set(key, next);
  }
  return { burned, wallet: next };
}

/** Wipe every wallet's Bell tickets for the window. Balances stay. */
export function wipeTickets(book: TicketBook): void {
  for (const [key, row] of book.entries()) {
    if (row.bellBalance <= 0) {
      book.delete(key);
      continue;
    }
    book.set(key, {
      ...row,
      tickets: 0,
      spentGme: 0,
      spentUsd: 0,
    });
  }
}

export type { OddsResult };

export function computeOdds(
  tickets: number,
  ticketsOut: number,
  oddsCapBps: number,
): OddsResult {
  return sharedComputeOdds(tickets, ticketsOut, oddsCapBps);
}

export interface LadderRow {
  rank: number;
  address: string;
  tickets: number;
  spentInWindowGme: number;
  spentInWindowUsd: number;
  share: number;
  odds: number;
  capped: boolean;
}

export function buildLadder(
  book: TicketBook,
  oddsCapBps: number,
  limit = 20,
  exclude: ReadonlySet<string> = new Set(),
): LadderRow[] {
  const eligible = new Map(
    [...book.entries()].filter(
      ([address, row]) => row.tickets > 0 && !exclude.has(address.toLowerCase()),
    ),
  );
  const ticketsOut = totalTickets(eligible);
  const rows = [...eligible.entries()]
    .map(([address, row]) => {
      const odds = computeOdds(row.tickets, ticketsOut, oddsCapBps);
      return {
        address,
        tickets: row.tickets,
        spentInWindowGme: row.spentGme,
        spentInWindowUsd: row.spentUsd,
        share: odds.share,
        odds: odds.odds,
        capped: odds.capped,
      };
    })
    .sort((a, b) => b.tickets - a.tickets || a.address.localeCompare(b.address))
    .slice(0, Math.max(0, limit))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return rows;
}

/** Deep-clone a ticket book (for snapshots). */
export function cloneBook(book: TicketBook): TicketBook {
  const next: TicketBook = new Map();
  for (const [key, row] of book.entries()) {
    next.set(key, { ...row });
  }
  return next;
}
