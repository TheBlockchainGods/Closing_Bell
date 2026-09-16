import { describe, expect, it } from "vitest";

import {
  applyBuy,
  totalTickets,
  wipeTickets,
  type TicketBook,
} from "../src/tickets/engine.js";
import {
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  syntheticBlockhash,
  totalDrawWeight,
} from "../src/draw/select.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { config } from "../src/config.js";
import { formatBuyAnnounce, formatRingResult } from "../src/telegram/format.js";
import { computePotDisplay } from "../src/pot/display.js";

const cfg = {
  minBuyUsd: 5,
  ticketsPerUsd: 1000,
  oddsCapBps: 1000,
};

describe("draw selection", () => {
  it("is deterministic for the same seed material", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 10, 100, 10, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 5, 50, 10, cfg);
    applyBuy(book, "0x3333333333333333333333333333333333333333", 2, 20, 10, cfg);

    const entrants = buildDrawEntrants(book, cfg.oddsCapBps);
    const seed = drawSeedHex({
      blockhashAtSnapshot: syntheticBlockhash("window-1", new Date("2026-09-14T20:00:00Z")),
      windowId: "window-1",
      potBalance: 1284.62,
    });
    const a = pickWeightedWinner(entrants, seed);
    const b = pickWeightedWinner(entrants, seed);
    expect(a?.winner.address).toBe(b?.winner.address);
    expect(a?.cursor).toBe(b?.cursor);
  });

  it("caps draw weight at ODDS_CAP_BPS of the bag", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 50, 500, 10, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 5, 50, 10, cfg);
    const entrants = buildDrawEntrants(book, cfg.oddsCapBps);
    const totalRaw = totalTickets(book);
    const maxWeight = Math.floor((totalRaw * cfg.oddsCapBps) / 10_000);
    expect(entrants[0].weight).toBe(maxWeight);
    expect(entrants[0].capped).toBe(true);
    expect(totalDrawWeight(entrants)).toBeLessThan(totalRaw);
  });
});

describe("dry-run window flow (in-memory)", () => {
  it("locks, picks a winner, wipes tickets", () => {
    const runtime = new BellRuntime(config);
    runtime.applyEvent({
      eventId: "t:0",
      adapter: "fixture",
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 1n,
      kind: "buy",
      wallet: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
      gmeAmount: 10,
      bellAmount: 1000,
      occurredAt: new Date(),
    });
    runtime.applyEvent({
      eventId: "t:1",
      adapter: "fixture",
      txHash: "0xabd",
      logIndex: 0,
      blockNumber: 2n,
      kind: "buy",
      wallet: "0x91cE0a4F72Bd8e13aC6f5019D2b74e8A3cF10d55",
      gmeAmount: 8,
      bellAmount: 800,
      occurredAt: new Date(),
    });

    expect(totalTickets(runtime.live)).toBeGreaterThan(0);

    const windowId = "test-window";
    const blockhash = syntheticBlockhash(windowId, new Date());
    runtime.lockBag({ windowId, bellAt: new Date(), blockhash });
    expect(runtime.phase).toBe("locked");
    expect(runtime.snapshot).not.toBeNull();

    const entrants = buildDrawEntrants(runtime.snapshot!, config.oddsCapBps);
    const pot = runtime.pot();
    const seed = drawSeedHex({
      blockhashAtSnapshot: blockhash,
      windowId,
      potBalance: pot.displayPot,
    });
    const picked = pickWeightedWinner(entrants, seed);
    expect(picked).not.toBeNull();

    const announce = formatRingResult({
      bellLabel: "Close Bell",
      winner: picked!.winner.address,
      odds: picked!.winner.odds,
      amountGme: pot.displayPot,
      ticketsAtRing: picked!.winner.tickets,
      dryRun: true,
      txHash: null,
    });
    expect(announce).toContain("DRY RUN");
    expect(announce).toContain("No GME sent");

    runtime.wipeAndSettle(new Date());
    expect(runtime.phase).toBe("settled");
    expect(totalTickets(runtime.live)).toBe(0);
  });
});

describe("telegram buy format", () => {
  it("formats a qualifying buy announce", () => {
    const pot = computePotDisplay({
      jackpotWalletBalance: 1000,
      ponsClaimable: 100,
      jackpotShareBps: 2000,
      gmeUsdPrice: 20,
    });
    const text = formatBuyAnnounce({
      wallet: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
      gmeSpent: 5,
      usdSpent: 100,
      minted: 100_000,
      odds: {
        tickets: 100_000,
        totalTickets: 200_000,
        share: 0.5,
        odds: 0.1,
        capped: true,
        oddsCap: 0.1,
      },
      pot,
      nextBellLabel: "Close Bell",
      countdown: { days: 0, hours: 1, minutes: 2, seconds: 3, totalMs: 0 },
      ladderRank: 1,
    });
    expect(text).toContain("BUY");
    expect(text).toContain("capped");
    expect(text).toContain("Ladder: #1");
  });
});

describe("wipeTickets still works", () => {
  it("clears the book", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 1, 10, 25, cfg);
    wipeTickets(book);
    expect(totalTickets(book)).toBe(0);
  });
});
