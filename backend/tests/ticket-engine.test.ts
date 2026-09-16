import { describe, expect, it } from "vitest";

import {
  applyBuy,
  applySell,
  buildLadder,
  burnTicketsProRata,
  computeOdds,
  mintTickets,
  totalTickets,
  wipeTickets,
  type TicketBook,
} from "../src/tickets/engine.js";
import { computePotDisplay } from "../src/pot/display.js";
import {
  etWallClockToInstant,
  nextBell,
  snapshotAtForBell,
  upcomingBells,
} from "../src/clock/market-clock.js";

const cfg = {
  minBuyUsd: 5,
  ticketsPerUsd: 1000,
  oddsCapBps: 1000,
};

describe("mintTickets", () => {
  it("mints floor(usd * TICKETS_PER_USD) for buys >= $5", () => {
    expect(mintTickets(5, cfg)).toBe(5_000);
    expect(mintTickets(25, cfg)).toBe(25_000);
    expect(mintTickets(5.9, cfg)).toBe(5_900);
  });

  it("mints 0 for buys below MIN_BUY_USD", () => {
    expect(mintTickets(4.99, cfg)).toBe(0);
    expect(mintTickets(0, cfg)).toBe(0);
  });
});

describe("sell burn pro-rata", () => {
  it("burns tickets proportional to % of $BELL balance sold", () => {
    expect(burnTicketsProRata(10_000, 400, 1_000)).toBe(4_000);
    expect(burnTicketsProRata(10_000, 1_000, 1_000)).toBe(10_000);
  });

  it("applySell updates the book", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0xAbc", 1, 1_000, 25, cfg); // $25 → 25_000 tickets
    expect(getTickets(book, "0xabc")).toBe(25_000);
    const { burned } = applySell(book, "0xAbc", 400, 1_000);
    expect(burned).toBe(10_000);
    expect(getTickets(book, "0xabc")).toBe(15_000);
  });
});

describe("odds cap", () => {
  it("caps per-wallet odds at ODDS_CAP_BPS", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 10, 100, 10, cfg); // $100
    applyBuy(book, "0x2222222222222222222222222222222222222222", 1, 10, 10, cfg); // $10
    const total = totalTickets(book);
    const big = computeOdds(100_000, total, cfg.oddsCapBps);
    expect(big.share).toBeGreaterThan(0.1);
    expect(big.odds).toBe(0.1);
    expect(big.capped).toBe(true);
  });

  it("buildLadder reports capped rows", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 50, 500, 10, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 5, 50, 10, cfg);
    const ladder = buildLadder(book, cfg.oddsCapBps, 10);
    expect(ladder[0].capped).toBe(true);
    expect(ladder[0].odds).toBe(0.1);
  });
});

describe("wipe", () => {
  it("clears all tickets after draw/window end", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 1, 10, 25, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 1, 10, 25, cfg);
    expect(totalTickets(book)).toBeGreaterThan(0);
    wipeTickets(book);
    expect(totalTickets(book)).toBe(0);
  });
});

describe("below-min buy still tracks balance", () => {
  it("mints 0 but later sells can burn nothing if no tickets", () => {
    const book: TicketBook = new Map();
    const { minted } = applyBuy(book, "0xabc", 0.1, 100, 20, cfg); // $2
    expect(minted).toBe(0);
    const { burned } = applySell(book, "0xabc", 50, 100);
    expect(burned).toBe(0);
  });
});

describe("pot display", () => {
  it("computes displayPot and breakdown", () => {
    const pot = computePotDisplay({
      jackpotWalletBalance: 1000,
      ponsClaimable: 500,
      jackpotShareBps: 2000,
      gmeUsdPrice: 20,
    });
    expect(pot.inPot).toBe(1000);
    expect(pot.accruingUnclaimed).toBe(100);
    expect(pot.displayPot).toBe(1100);
    expect(pot.displayPotUsd).toBe(22_000);
  });
});

describe("market clock", () => {
  it("returns next ET bell with DST-safe wall clock", () => {
    // A Wednesday morning before open.
    const now = etWallClockToInstant(2026, 9, 16, 8, 0);
    const bell = nextBell(now, true);
    expect(bell?.kind).toBe("open");
    expect(bell?.label).toBe("Open Bell");
  });

  it("BELLS_24_7=false skips Saturday/Sunday", () => {
    const fridayAfterClose = etWallClockToInstant(2026, 9, 18, 17, 0);
    const bells = upcomingBells(fridayAfterClose, 1, false);
    expect(bells[0]?.kind).toBe("open");
    // Monday 2026-09-21
    expect(bells[0]?.at.toISOString().startsWith("2026-09-21")).toBe(true);
    expect(bells[0]?.carriesWeekend).toBe(true);
  });

  it("snapshot leads the bell by SNAPSHOT_LEAD_SECONDS", () => {
    const bellAt = etWallClockToInstant(2026, 9, 16, 16, 0);
    const snap = snapshotAtForBell(bellAt, 120);
    expect(bellAt.getTime() - snap.getTime()).toBe(120_000);
  });
});

function getTickets(book: TicketBook, address: string): number {
  return book.get(address.toLowerCase())?.tickets ?? 0;
}
