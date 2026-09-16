/**
 * Shared draw math for Closing Bell.
 * Used by the backend keeper and the public /verify page so they cannot drift.
 */

import { keccak256, toBytes } from "viem";

/** Bump only when the published algorithm changes. */
export const FORMULA_VERSION = "closing-bell-draw-v1" as const;

export interface DrawEntrant {
  address: string;
  tickets: number;
  /** Weight used in the draw after per-wallet odds cap. */
  weight: number;
  share: number;
  odds: number;
  capped: boolean;
}

export interface OddsResult {
  tickets: number;
  totalTickets: number;
  share: number;
  odds: number;
  capped: boolean;
  oddsCap: number;
  message?: string;
}

/** Wallet → ticket count (snapshot bag). */
export type TicketSnapshotInput =
  | Map<string, number>
  | Record<string, number>
  | Array<{ address: string; tickets: number }>;

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function formatPotBalance(potBalance: string | number): string {
  return typeof potBalance === "number" ? potBalance.toFixed(8) : potBalance;
}

export function computeOdds(
  tickets: number,
  ticketsOut: number,
  oddsCapBps: number,
): OddsResult {
  const oddsCap = oddsCapBps / 10_000;
  if (ticketsOut <= 0 || tickets <= 0) {
    return {
      tickets: Math.max(0, tickets),
      totalTickets: Math.max(0, ticketsOut),
      share: 0,
      odds: 0,
      capped: false,
      oddsCap,
      message: "No tickets this window",
    };
  }
  const share = tickets / ticketsOut;
  const odds = Math.min(oddsCap, share);
  return {
    tickets,
    totalTickets: ticketsOut,
    share,
    odds,
    capped: share > oddsCap,
    oddsCap,
  };
}

/** Normalize any snapshot shape into a Map of lowercase address → tickets. */
export function normalizeTicketSnapshot(
  input: TicketSnapshotInput,
): Map<string, number> {
  const out = new Map<string, number>();
  if (input instanceof Map) {
    for (const [address, tickets] of input.entries()) {
      const key = normalizeAddress(address);
      const n = Number(tickets);
      if (!Number.isFinite(n) || n <= 0) continue;
      out.set(key, Math.floor(n));
    }
    return out;
  }
  if (Array.isArray(input)) {
    for (const row of input) {
      if (!row || typeof row.address !== "string") continue;
      const key = normalizeAddress(row.address);
      const n = Number(row.tickets);
      if (!Number.isFinite(n) || n <= 0) continue;
      out.set(key, (out.get(key) ?? 0) + Math.floor(n));
    }
    return out;
  }
  for (const [address, tickets] of Object.entries(input)) {
    const key = normalizeAddress(address);
    const n = Number(tickets);
    if (!Number.isFinite(n) || n <= 0) continue;
    out.set(key, Math.floor(n));
  }
  return out;
}

export function totalTicketsInSnapshot(book: Map<string, number>): number {
  let sum = 0;
  for (const tickets of book.values()) sum += tickets;
  return sum;
}

/**
 * Cap excess ticket weight so one wallet cannot own more than ODDS_CAP_BPS
 * of the raw bag. Excess is simply not counted (matches product copy).
 * Entrants are sorted weight DESC, then address ASC (walk order).
 */
export function buildDrawEntrants(
  snapshot: TicketSnapshotInput,
  oddsCapBps: number,
): DrawEntrant[] {
  const book = normalizeTicketSnapshot(snapshot);
  const ticketsOut = totalTicketsInSnapshot(book);
  if (ticketsOut <= 0) return [];

  const maxWeight = Math.max(
    1,
    Math.floor((ticketsOut * oddsCapBps) / 10_000),
  );

  const entrants: DrawEntrant[] = [];
  for (const [address, tickets] of book.entries()) {
    if (tickets <= 0) continue;
    const odds = computeOdds(tickets, ticketsOut, oddsCapBps);
    entrants.push({
      address,
      tickets,
      weight: Math.min(tickets, maxWeight),
      share: odds.share,
      odds: odds.odds,
      capped: odds.capped,
    });
  }

  return entrants.sort(
    (a, b) => b.weight - a.weight || a.address.localeCompare(b.address),
  );
}

export function totalDrawWeight(entrants: DrawEntrant[]): number {
  return entrants.reduce((sum, e) => sum + e.weight, 0);
}

/**
 * Seed material (UTF-8 bytes, then keccak256):
 *   lowercase(blockhashAtSnapshot) | windowId | potBalance
 * potBalance uses toFixed(8) when passed as a number.
 */
export function drawSeedHex(input: {
  blockhashAtSnapshot: string;
  windowId: string;
  potBalance: string | number;
}): `0x${string}` {
  const pot = formatPotBalance(input.potBalance);
  const material = `${input.blockhashAtSnapshot.toLowerCase()}|${input.windowId}|${pot}`;
  return keccak256(toBytes(material));
}

export function pickWeightedWinner(
  entrants: DrawEntrant[],
  seedHex: `0x${string}`,
): { winner: DrawEntrant; cursor: bigint; totalWeight: number } | null {
  const active = entrants.filter((e) => e.weight > 0);
  const totalWeight = totalDrawWeight(active);
  if (totalWeight <= 0 || active.length === 0) return null;

  const cursor = BigInt(seedHex) % BigInt(totalWeight);
  let remaining = cursor;
  for (const entrant of active) {
    if (remaining < BigInt(entrant.weight)) {
      return { winner: entrant, cursor, totalWeight };
    }
    remaining -= BigInt(entrant.weight);
  }
  return {
    winner: active[active.length - 1],
    cursor,
    totalWeight,
  };
}

/** Fixture / offline stand-in when no chain blockhash is available. */
export function syntheticBlockhash(windowId: string, at: Date): `0x${string}` {
  return keccak256(toBytes(`${windowId}:${at.toISOString()}`));
}

/**
 * Canonical snapshot hash:
 * sort addresses ASC, join `address:tickets` with newlines, keccak256 UTF-8.
 */
export function snapshotHash(snapshot: TicketSnapshotInput): `0x${string}` {
  const book = normalizeTicketSnapshot(snapshot);
  const lines = [...book.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([address, tickets]) => `${address}:${tickets}`);
  return keccak256(toBytes(lines.join("\n")));
}

export function snapshotToRecord(
  snapshot: TicketSnapshotInput,
): Record<string, number> {
  const book = normalizeTicketSnapshot(snapshot);
  const out: Record<string, number> = {};
  for (const [address, tickets] of [...book.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    out[address] = tickets;
  }
  return out;
}
