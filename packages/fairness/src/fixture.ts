import {
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  syntheticBlockhash,
} from "./draw.js";
import { buildRingReceipt, type RingReceipt } from "./receipt.js";

/**
 * Worked dry-run fixture so /verify can load green without hunting files.
 * Tampering with snapshot tickets or seed inputs must produce MISMATCH.
 */
export function createFixtureReceipt(): RingReceipt {
  const windowId = "bell-close-2026-09-15T20:00:00.000Z";
  const snapshotAt = new Date("2026-09-15T19:58:00.000Z");
  const snapshot = {
    "0x1111111111111111111111111111111111111111": 100_000,
    "0x2222222222222222222222222222222222222222": 50_000,
    "0x3333333333333333333333333333333333333333": 20_000,
  };
  const oddsCapBps = 1000;
  const potBalance = 1284.62;
  const blockhashAtSnapshot = syntheticBlockhash(windowId, snapshotAt);
  const entrants = buildDrawEntrants(snapshot, oddsCapBps);
  const seed = drawSeedHex({
    blockhashAtSnapshot,
    windowId,
    potBalance,
  });
  const picked = pickWeightedWinner(entrants, seed);
  if (!picked) {
    throw new Error("fixture bag produced no winner");
  }

  return buildRingReceipt({
    windowId,
    announcedWinner: picked.winner.address,
    blockhashAtSnapshot,
    potBalance,
    oddsCapBps,
    snapshot,
    dryRun: true,
    txHash: null,
    ringedAt: "2026-09-15T20:00:00.000Z",
  });
}

export const FIXTURE_RECEIPT: RingReceipt = createFixtureReceipt();

/** Snapshot-only JSON for the separate paste field demo. */
export const FIXTURE_SNAPSHOT = FIXTURE_RECEIPT.snapshot!;
