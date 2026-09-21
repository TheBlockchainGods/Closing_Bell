import { describe, expect, it } from "vitest";

import {
  FIXTURE_RECEIPT,
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  receiptPaidAmountGme,
  receiptSettledPaidGme,
  snapshotHash,
  syntheticBlockhash,
  verifyRing,
} from "./index.js";

describe("fixture receipt", () => {
  it("verifies MATCH against itself", () => {
    const result = verifyRing(FIXTURE_RECEIPT);
    expect(result.ok).toBe(true);
    expect(result.match).toBe(true);
    expect(result.computedWinner).toBe(FIXTURE_RECEIPT.announcedWinner);
    expect(result.snapshotHashMatch).toBe(true);
  });

  it("MISMATCH when snapshot tickets are tampered", () => {
    const tampered = {
      ...FIXTURE_RECEIPT,
      snapshot: {
        ...FIXTURE_RECEIPT.snapshot!,
        "0x1111111111111111111111111111111111111111": 1,
      },
    };
    const result = verifyRing(tampered);
    expect(result.match).toBe(false);
    expect(result.snapshotHashMatch).toBe(false);
  });

  it("MISMATCH when pot / seed material is tampered", () => {
    const tampered = {
      ...FIXTURE_RECEIPT,
      potBalance: "9999.00000000",
    };
    const result = verifyRing(tampered);
    expect(result.match).toBe(false);
  });

  it("keeps MATCH when paidAmountGme differs from the seed pot", () => {
    const withPayout = {
      ...FIXTURE_RECEIPT,
      paidAmountGme: "8.8582515",
      txHash:
        "0x08ec83a38d49b8d8e225714920298dcfad9ed8c6e2b3be072c14dad7bdce37c9",
    };
    const result = verifyRing(withPayout);
    expect(result.ok).toBe(true);
    expect(result.match).toBe(true);
    expect(result.computedWinner).toBe(FIXTURE_RECEIPT.announcedWinner);
    expect(receiptSettledPaidGme(withPayout)).toBe(8.8582515);
    expect(receiptPaidAmountGme(withPayout)).toBe(8.8582515);
    expect(receiptSettledPaidGme(FIXTURE_RECEIPT)).toBeNull();
  });

  it("teaches on missing fields", () => {
    const result = verifyRing({ formulaVersion: "closing-bell-draw-v1" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("missing field windowId"))).toBe(
      true,
    );
  });
});

describe("draw selection", () => {
  it("is deterministic for the same seed material", () => {
    const snapshot = {
      "0x1111111111111111111111111111111111111111": 100_000,
      "0x2222222222222222222222222222222222222222": 50_000,
      "0x3333333333333333333333333333333333333333": 20_000,
    };
    const entrants = buildDrawEntrants(snapshot, 1000);
    const seed = drawSeedHex({
      blockhashAtSnapshot: syntheticBlockhash(
        "window-1",
        new Date("2026-09-14T20:00:00Z"),
      ),
      windowId: "window-1",
      potBalance: 1284.62,
    });
    const a = pickWeightedWinner(entrants, seed);
    const b = pickWeightedWinner(entrants, seed);
    expect(a?.winner.address).toBe(b?.winner.address);
    expect(a?.cursor).toBe(b?.cursor);
    expect(snapshotHash(snapshot)).toMatch(/^0x[0-9a-f]+$/);
  });
});
