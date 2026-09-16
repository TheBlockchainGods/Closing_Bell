/**
 * Thin adapter: TicketBook → shared fairness draw math.
 * Source of truth for the algorithm lives in @closing-bell/fairness.
 */

import {
  FORMULA_VERSION,
  buildDrawEntrants as buildDrawEntrantsFromSnapshot,
  drawSeedHex,
  pickWeightedWinner,
  snapshotHash,
  snapshotToRecord,
  syntheticBlockhash,
  totalDrawWeight,
  type DrawEntrant,
} from "@closing-bell/fairness";

import type { TicketBook } from "../tickets/engine.js";

export {
  FORMULA_VERSION,
  drawSeedHex,
  pickWeightedWinner,
  snapshotHash,
  snapshotToRecord,
  syntheticBlockhash,
  totalDrawWeight,
  type DrawEntrant,
};

export function buildDrawEntrants(
  book: TicketBook,
  oddsCapBps: number,
): DrawEntrant[] {
  const snapshot = new Map<string, number>();
  for (const [address, row] of book.entries()) {
    if (row.tickets > 0) snapshot.set(address, row.tickets);
  }
  return buildDrawEntrantsFromSnapshot(snapshot, oddsCapBps);
}

export function ticketBookToSnapshot(book: TicketBook): Record<string, number> {
  const snapshot = new Map<string, number>();
  for (const [address, row] of book.entries()) {
    if (row.tickets > 0) snapshot.set(address, row.tickets);
  }
  return snapshotToRecord(snapshot);
}
