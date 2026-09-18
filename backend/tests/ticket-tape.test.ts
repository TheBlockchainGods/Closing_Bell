import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import {
  buildRingReceipt,
  drawSeedHex,
  formatPotBalance,
  pickWeightedWinner,
  verifyRing,
} from "@closing-bell/fairness";
import { config } from "../src/config.js";
import { buildServer } from "../src/api/server.js";
import {
  fixtureRowToEvent,
  loadFixtureRows,
  type FixtureRow,
} from "../src/indexer/adapters/fixture.js";
import { IndexerService } from "../src/indexer/service.js";
import type { ChainTradeEvent } from "../src/indexer/types.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import {
  buildDrawEntrants,
  syntheticBlockhash,
  ticketBookToSnapshot,
} from "../src/draw/select.js";
import { getWallet, totalTickets } from "../src/tickets/engine.js";

const here = dirname(fileURLToPath(import.meta.url));

interface TapeFile {
  gmeUsdPrice: number;
  minBuyUsd: number;
  ticketsPerUsd: number;
  oddsCapBps: number;
  wallets: Record<string, string>;
  trades: Array<FixtureRow & { id: string; wallet: string }>;
  expectAfterTape: {
    alice: { tickets: number; bellBalance: number };
    bob: { tickets: number; bellBalance: number };
    carol: { tickets: number; bellBalance: number };
    dave: { tickets: number; bellBalance: number };
    totalTickets: number;
    bobCapped: boolean;
    bobTicketsUnchangedByCap: number;
    ladder: Array<{ wallet: string; tickets: number; capped: boolean }>;
  };
  expectAfterWipe: {
    alice: { tickets: number; bellBalance: number };
    bob: { tickets: number; bellBalance: number };
    carol: { tickets: number; bellBalance: number };
    dave: { tickets: number; bellBalance: number };
    totalTickets: number;
  };
}

function loadTape(): TapeFile {
  const raw = readFileSync(
    resolve(here, "../fixtures/ticket-tape.json"),
    "utf8",
  );
  return JSON.parse(raw) as TapeFile;
}

function resolveWallet(tape: TapeFile, nameOrAddr: string): string {
  return (tape.wallets[nameOrAddr] ?? nameOrAddr).toLowerCase();
}

function tapeRuntime(tape: TapeFile): BellRuntime {
  return new BellRuntime({
    ...config,
    gmeUsdPrice: tape.gmeUsdPrice,
    minBuyUsd: tape.minBuyUsd,
    ticketsPerUsd: tape.ticketsPerUsd,
    oddsCapBps: tape.oddsCapBps,
  });
}

function toEvent(tape: TapeFile, row: TapeFile["trades"][number]): ChainTradeEvent {
  return fixtureRowToEvent({
    ...row,
    wallet: resolveWallet(tape, row.wallet),
  });
}

function memoryPool(): Pool {
  const events = new Set<string>();
  return {
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        const text = sql.trim();
        if (
          text.startsWith("BEGIN") ||
          text.startsWith("COMMIT") ||
          text.startsWith("ROLLBACK")
        ) {
          return { rowCount: 0, rows: [] };
        }
        if (text.includes("INSERT INTO ingested_events")) {
          const id = String(params?.[0]);
          if (events.has(id)) return { rowCount: 0, rows: [] };
          events.add(id);
          return { rowCount: 1, rows: [{ event_id: id }] };
        }
        throw new Error(`unexpected sql in fixture ingest mock: ${text.slice(0, 60)}`);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
}

const tape = loadTape();

describe("checked-in ticket tape", () => {

  it("replays buys, a sell, a below-min buy, and standings", () => {
    const runtime = tapeRuntime(tape);
    for (const row of tape.trades) {
      runtime.applyEvent(toEvent(tape, row));
    }

    const exp = tape.expectAfterTape;
    const alice = getWallet(runtime.live, tape.wallets.alice);
    const bob = getWallet(runtime.live, tape.wallets.bob);
    const carol = getWallet(runtime.live, tape.wallets.carol);
    const dave = getWallet(runtime.live, tape.wallets.dave);

    expect(alice.tickets).toBe(exp.alice.tickets);
    expect(alice.bellBalance).toBe(exp.alice.bellBalance);
    expect(bob.tickets).toBe(exp.bob.tickets);
    expect(bob.bellBalance).toBe(exp.bob.bellBalance);
    expect(carol.tickets).toBe(exp.carol.tickets);
    expect(carol.bellBalance).toBe(exp.carol.bellBalance);
    expect(dave.tickets).toBe(exp.dave.tickets);
    expect(dave.bellBalance).toBe(exp.dave.bellBalance);
    expect(totalTickets(runtime.live)).toBe(exp.totalTickets);

    const odds = runtime.oddsFor(tape.wallets.bob);
    expect(odds.capped).toBe(exp.bobCapped);
    expect(odds.tickets).toBe(exp.bobTicketsUnchangedByCap);
    expect(bob.tickets).toBe(exp.bobTicketsUnchangedByCap);

    const ladder = runtime.ladder(10);
    expect(ladder.map((row) => row.address)).toEqual(
      exp.ladder.map((row) => resolveWallet(tape, row.wallet)),
    );
    for (const [index, row] of exp.ladder.entries()) {
      expect(ladder[index].tickets).toBe(row.tickets);
      expect(ladder[index].capped).toBe(row.capped);
    }
    expect(ladder.some((row) => row.address === tape.wallets.carol.toLowerCase())).toBe(
      false,
    );
  });

  it("does not double-mint a duplicate tx", async () => {
    const runtime = tapeRuntime(tape);
    const indexer = new IndexerService(memoryPool(), runtime, [], 0n);
    const first = toEvent(tape, tape.trades[0]);
    expect(await indexer.ingest(first)).toBe(true);
    expect(getWallet(runtime.live, first.wallet).tickets).toBe(20_000);
    expect(await indexer.ingest(first)).toBe(false);
    expect(getWallet(runtime.live, first.wallet).tickets).toBe(20_000);
  });

  it("wipes tickets for the window and keeps $BELL balances", () => {
    const runtime = tapeRuntime(tape);
    for (const row of tape.trades) {
      runtime.applyEvent(toEvent(tape, row));
    }
    runtime.wipeAndSettle(new Date("2026-09-17T16:00:00.000Z"), 0);
    const exp = tape.expectAfterWipe;
    expect(getWallet(runtime.live, tape.wallets.alice)).toMatchObject(exp.alice);
    expect(getWallet(runtime.live, tape.wallets.bob)).toMatchObject(exp.bob);
    expect(getWallet(runtime.live, tape.wallets.carol)).toMatchObject(exp.carol);
    expect(getWallet(runtime.live, tape.wallets.dave)).toMatchObject(exp.dave);
    expect(totalTickets(runtime.live)).toBe(exp.totalTickets);
  });

  it("produces a MATCH receipt after a fixture ring", () => {
    const runtime = tapeRuntime(tape);
    for (const row of tape.trades) {
      runtime.applyEvent(toEvent(tape, row));
    }
    const windowId = "tape-bell-close";
    const bellAt = new Date("2026-09-17T20:00:00.000Z");
    const blockhash = syntheticBlockhash(windowId, bellAt);
    runtime.lockBag({ windowId, bellAt, blockhash });
    const book = runtime.snapshot ?? runtime.live;
    const potBalance = formatPotBalance(runtime.pot().displayPot);
    const snapshot = ticketBookToSnapshot(book);
    const seed = drawSeedHex({
      blockhashAtSnapshot: blockhash,
      windowId,
      potBalance,
    });
    const entrants = buildDrawEntrants(book, tape.oddsCapBps);
    const picked = pickWeightedWinner(entrants, seed);
    expect(picked).not.toBeNull();
    const receipt = buildRingReceipt({
      windowId,
      announcedWinner: picked!.winner.address,
      blockhashAtSnapshot: blockhash,
      potBalance,
      oddsCapBps: tape.oddsCapBps,
      snapshot,
      dryRun: true,
      ringedAt: bellAt.toISOString(),
    });
    const verified = verifyRing(receipt);
    expect(verified.ok).toBe(true);
    expect(verified.match).toBe(true);
    expect(verified.computedWinner).toBe(picked!.winner.address);
  });
});

describe("production fixture swaps.json", () => {
  it("replays the live fixture tape into a non-empty capped ladder", () => {
    const runtime = new BellRuntime(config);
    for (const row of loadFixtureRows()) {
      runtime.applyEvent(fixtureRowToEvent(row));
    }
    expect(totalTickets(runtime.live)).toBeGreaterThan(0);
    const ladder = runtime.ladder(10);
    expect(ladder[0]?.capped).toBe(true);
    const belowMin = getWallet(
      runtime.live,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(belowMin.tickets).toBe(0);
    expect(belowMin.bellBalance).toBeGreaterThan(0);
    const top = runtime.oddsFor("0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137");
    expect(top.tickets).toBeGreaterThan(0);
    expect(top.capped).toBe(true);
    expect(top.spentGme).toBeGreaterThan(0);
    expect(top.spentUsd).toBeGreaterThan(0);
    expect(top.spentInWindowGme).toBe(top.spentGme);
    expect(top.spentInWindowUsd).toBe(top.spentUsd);
  });
});

describe("read-only inspect (no /admin)", () => {
  it("exposes wallet tickets on /odds and fixture tape on /fixture/trades", async () => {
    const runtime = tapeRuntime(tape);
    for (const row of tape.trades) {
      runtime.applyEvent(toEvent(tape, row));
    }
    const app = buildServer(runtime);
    const odds = await app.inject({
      method: "GET",
      url: `/odds?address=${tape.wallets.alice}`,
    });
    expect(odds.statusCode).toBe(200);
    const oddsBody = odds.json();
    expect(oddsBody.tickets).toBe(tape.expectAfterTape.alice.tickets);
    expect(oddsBody.bellBalance).toBe(tape.expectAfterTape.alice.bellBalance);
    expect(oddsBody.spentGme).toBeGreaterThan(0);
    expect(oddsBody.spentUsd).toBeGreaterThan(0);
    expect(oddsBody.spentInWindowGme).toBe(oddsBody.spentGme);
    expect(oddsBody.spentInWindowUsd).toBe(oddsBody.spentUsd);

    const trades = await app.inject({ method: "GET", url: "/fixture/trades" });
    if (config.fixtureMode) {
      expect(trades.statusCode).toBe(200);
      const body = trades.json();
      expect(body.fixtureMode).toBe(true);
      expect(body.count).toBeGreaterThan(0);
      expect(Array.isArray(body.trades)).toBe(true);
    } else {
      expect(trades.statusCode).toBe(404);
    }
    await app.close();
  }, 20_000);
});
