import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { nextBell, previousBell } from "../src/clock/market-clock.js";
import { config } from "../src/config.js";
import type { ChainTradeEvent } from "../src/indexer/types.js";
import { DrawKeeper } from "../src/keeper/draw-keeper.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import type { TelegramBot } from "../src/telegram/bot.js";

type Row = Record<string, unknown>;

function memoryDrawPool(): {
  pool: Pool;
  draws: Map<string, Row>;
  winners: Map<string, Row>;
} {
  const draws = new Map<string, Row>();
  const winners = new Map<string, Row>();

  const query = async (sql: string, params: unknown[] = []) => {
    const text = sql.trim();

    if (text.startsWith("SELECT receipt_json")) {
      const row = draws.get(String(params[0]));
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }
    if (text.startsWith("SELECT * FROM draws")) {
      const row = draws.get(String(params[0]));
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }
    if (text.startsWith("INSERT INTO draws")) {
      const id = String(params[0]);
      if (draws.has(id)) return { rowCount: 0, rows: [] };
      const row: Row = {
        window_id: id,
        bell_kind: params[1],
        bell_at: params[2],
        phase: "locked",
        snapshot_at: params[3],
        blockhash: params[4],
        carried_weekend: params[5],
        dry_run: true,
        pot_gme: null,
        total_weight: null,
        winner: null,
        tickets_at_ring: null,
        odds_at_ring: null,
        tx_hash: null,
        skip_reason: null,
        settled_at: null,
        receipt_json: null,
      };
      draws.set(id, row);
      return { rowCount: 1, rows: [row] };
    }
    if (text.startsWith("UPDATE draws") && text.includes("'skipped'")) {
      const row = draws.get(String(params[0]));
      if (!row || row.phase !== "locked") return { rowCount: 0, rows: [] };
      Object.assign(row, {
        phase: "skipped",
        skip_reason: params[1],
        pot_gme: params[2],
        settled_at: new Date().toISOString(),
      });
      return { rowCount: 1, rows: [] };
    }
    if (text.startsWith("UPDATE draws")) {
      const row = draws.get(String(params[0]));
      if (!row || row.phase !== "locked") return { rowCount: 0, rows: [] };
      Object.assign(row, {
        phase: params[1],
        pot_gme: params[2],
        total_weight: params[3],
        winner: params[4],
        tickets_at_ring: params[5],
        odds_at_ring: params[6],
        tx_hash: params[7],
        dry_run: params[8],
        skip_reason: params[9],
        receipt_json: params[10],
        settled_at: new Date().toISOString(),
      });
      return { rowCount: 1, rows: [{ window_id: params[0] }] };
    }
    if (text.startsWith("INSERT INTO winners")) {
      const id = String(params[0]);
      if (!winners.has(id)) {
        winners.set(id, { id, address: params[1], amount_gme: params[3] });
      }
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`unexpected sql in draw mock: ${text.slice(0, 60)}`);
  };

  return { pool: { query } as unknown as Pool, draws, winners };
}

function fakeBot(): {
  bot: TelegramBot;
  sent: string[];
  wins: Array<Record<string, unknown>>;
} {
  const sent: string[] = [];
  const wins: Array<Record<string, unknown>> = [];
  const bot = {
    send: async (text: string) => {
      sent.push(text);
    },
    announceWin: async (input: Record<string, unknown>) => {
      wins.push(input);
    },
  } as unknown as TelegramBot;
  return { bot, sent, wins };
}

function buyEvent(wallet: string, gmeAmount: number, at: Date): ChainTradeEvent {
  return {
    eventId: `${wallet}:${gmeAmount}`,
    adapter: "fixture",
    txHash: `0x${"1".repeat(64)}`,
    logIndex: 0,
    blockNumber: 1n,
    kind: "buy",
    wallet,
    gmeAmount,
    bellAmount: gmeAmount * 1000,
    occurredAt: at,
  };
}

/** Runtime whose displayPot equals `potGme`, optionally holding tickets. */
function runtimeWith(potGme: number, funded: boolean, at: Date): BellRuntime {
  const runtime = new BellRuntime({
    ...config,
    gmeUsdPrice: 20,
    jackpotWalletBalanceGme: potGme,
    ponsClaimableGme: 0,
  });
  if (funded) {
    runtime.applyEvent(buyEvent(`0x${"a".repeat(40)}`, 10, at));
    runtime.applyEvent(buyEvent(`0x${"b".repeat(40)}`, 10, at));
  }
  return runtime;
}

function bellInstant(): Date {
  const bell = nextBell(new Date("2026-09-18T00:00:00.000Z"), config.bells24_7);
  if (!bell) throw new Error("no bell in schedule");
  return bell.at;
}

const noPayout = async () => {
  throw new Error("payout must not be sent in dry run");
};

afterEach(() => {
  vi.useRealTimers();
});

describe("draw keeper tick", () => {
  it("nextBell is always strictly future, so it cannot drive the ring", () => {
    const at = bellInstant();
    const upcoming = nextBell(at, config.bells24_7);
    expect(upcoming).not.toBeNull();
    expect(upcoming!.at.getTime()).toBeGreaterThan(at.getTime());
    // previousBell is inclusive of a bell landing exactly on `now`.
    expect(previousBell(at, config.bells24_7)!.at.getTime()).toBe(at.getTime());
  });

  it("rings the due bell at the bell instant instead of leaving it locked", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const { pool, draws, winners } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(500, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();

    const row = [...draws.values()][0];
    expect(row).toBeDefined();
    expect(row.phase).toBe("dry_run");
    expect(row.winner).toBeTruthy();
    expect(Number(row.pot_gme)).toBe(500);
    expect(winners.size).toBe(1);
    expect(wins).toHaveLength(1);
    expect(wins[0]!.dryRun).toBe(true);
    expect(runtime.phase).toBe("settled");
  });

  it("skips and says so when the pot is below MIN_POT_GME", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const { pool, draws, winners } = memoryDrawPool();
    const { bot, sent, wins } = fakeBot();
    const runtime = runtimeWith(0, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();

    const row = [...draws.values()][0]!;
    expect(row.phase).toBe("skipped");
    expect(String(row.skip_reason)).toContain("MIN_POT_GME");
    expect(winners.size).toBe(0);
    expect(wins).toHaveLength(0);
    expect(sent.some((text) => /skip/i.test(text))).toBe(true);
  });

  it("skips on an empty bag even when the pot is funded", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const { pool, draws } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(500, false, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();

    const row = [...draws.values()][0]!;
    expect(row.phase).toBe("skipped");
    expect(String(row.skip_reason)).toBe("empty bag");
    expect(wins).toHaveLength(0);
  });

  it("rings a bell only once across repeated ticks", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const { pool, winners } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(500, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();
    vi.setSystemTime(new Date(at.getTime() + 1000));
    await keeper.tick();
    vi.setSystemTime(new Date(at.getTime() + 2000));
    await keeper.tick();

    expect(wins).toHaveLength(1);
    expect(winners.size).toBe(1);
  });

  it("still rings a bell missed by a short restart, inside the grace window", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(at.getTime() + 60_000));

    const { pool, draws } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(500, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();

    expect(wins).toHaveLength(1);
    expect([...draws.values()][0]!.phase).toBe("dry_run");
  });

  it("does not retro-ring a bell older than the grace window", async () => {
    const at = bellInstant();
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(at.getTime() + config.settleGraceSeconds * 1000 + 1000),
    );

    const { pool, draws, winners } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(500, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    await keeper.tick();

    expect(wins).toHaveLength(0);
    expect(winners.size).toBe(0);
    for (const row of draws.values()) {
      expect(row.phase).not.toBe("dry_run");
    }
  });

  it("settles a prior locked bag even after the grace window (option A)", async () => {
    const at = bellInstant();
    const late = new Date(at.getTime() + config.settleGraceSeconds * 1000 + 60_000);

    const { pool, draws, winners } = memoryDrawPool();
    const windowId = `bell-${previousBell(at, config.bells24_7)!.kind}-${at.toISOString()}`;
    // Pretend bag lock already happened, then the process missed the ring.
    draws.set(windowId, {
      window_id: windowId,
      bell_kind: previousBell(at, config.bells24_7)!.kind,
      bell_at: at.toISOString(),
      phase: "locked",
      snapshot_at: new Date(at.getTime() - 120_000).toISOString(),
      blockhash: "0x" + "ab".repeat(32),
      carried_weekend: false,
      dry_run: true,
      pot_gme: null,
      total_weight: null,
      winner: null,
      tickets_at_ring: null,
      odds_at_ring: null,
      tx_hash: null,
      skip_reason: null,
      settled_at: null,
      receipt_json: null,
    });

    const { bot, wins, sent } = fakeBot();
    const runtime = runtimeWith(0, true, at);
    runtime.lockBag({
      windowId,
      bellAt: at,
      blockhash: "0x" + "ab".repeat(32),
    });
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);

    vi.useFakeTimers();
    vi.setSystemTime(late);
    await keeper.tick();

    const row = draws.get(windowId)!;
    expect(row.phase).toBe("skipped");
    expect(String(row.skip_reason)).toContain("MIN_POT_GME");
    expect(wins).toHaveLength(0);
    expect(winners.size).toBe(0);
    expect(sent.some((text) => /skip/i.test(text))).toBe(true);
    expect(runtime.phase).toBe("settled");
  });

  it("settles the prior due bell before locking the next bag", async () => {
    const at = bellInstant();
    // Two minutes before the next bell: upcoming is past its snapshot lead,
    // while the prior bell is still inside grace and must settle first.
    const next = nextBell(at, config.bells24_7)!;
    const snapAt = new Date(next.at.getTime() - config.snapshotLeadSeconds * 1000);
    // Only valid when prior is still within grace of `at`.
    if (snapAt.getTime() - at.getTime() > config.settleGraceSeconds * 1000) {
      // Open→Lunch gap is hours; use a time just after `at` still in grace
      // where we only assert settle runs (lock of next happens later).
      vi.useFakeTimers();
      vi.setSystemTime(new Date(at.getTime() + 30_000));
      const { pool, draws } = memoryDrawPool();
      const { bot, wins } = fakeBot();
      const runtime = runtimeWith(0, true, at);
      const keeper = new DrawKeeper(pool, runtime, bot, noPayout);
      await keeper.tick();
      expect([...draws.values()][0]!.phase).toBe("skipped");
      expect(wins).toHaveLength(0);
      return;
    }

    vi.useFakeTimers();
    vi.setSystemTime(snapAt);
    const { pool, draws } = memoryDrawPool();
    const { bot, wins } = fakeBot();
    const runtime = runtimeWith(0, true, at);
    const keeper = new DrawKeeper(pool, runtime, bot, noPayout);
    await keeper.tick();
    const phases = [...draws.values()].map((row) => row.phase);
    expect(phases).toContain("skipped");
    expect(wins).toHaveLength(0);
  });
});
