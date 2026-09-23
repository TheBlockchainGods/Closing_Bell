import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import type { Pool } from "pg";

import { LaunchPhase } from "../src/indexer/abi.js";
import { PonsLaunchAdapter } from "../src/indexer/adapters/pons-launch.js";
import {
  bootCursor,
  cursorSeed,
  mergeCursor,
} from "../src/indexer/cursor.js";
import { encodeCurveBuyLog } from "../src/indexer/encode-log.js";
import type { ChainReader, LaunchRecord, LogQuery, RpcLog } from "../src/indexer/rpc.js";
import { IndexerService } from "../src/indexer/service.js";
import { config } from "../src/config.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { getWallet, totalTickets } from "../src/tickets/engine.js";

const N = 1000n;
const TIP = N + 10n;
const CURVE = "0x1111111111111111111111111111111111111111" as Hex;
const TOKEN = "0x2222222222222222222222222222222222222222" as Hex;
const QUOTE = "0x3333333333333333333333333333333333333333" as Hex;
const FOUNDATION = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1" as Hex;
const SNIPER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1" as Hex;
const LATER = "0xccccccccccccccccccccccccccccccccccccccc1" as Hex;
const LAUNCH_TX =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;

/** launchAndBuy (log 4) + same-block snipe (log 5) + a later buy. */
function backfillLogs(): RpcLog[] {
  const launchBuy = encodeCurveBuyLog({
    buyer: FOUNDATION,
    recipient: FOUNDATION,
    quoteIn: 10n * 10n ** 18n,
    tokensOut: 1000n * 10n ** 18n,
    fee: 0n,
    tax: 0n,
  });
  const snipe = encodeCurveBuyLog({
    buyer: SNIPER,
    recipient: SNIPER,
    quoteIn: 5n * 10n ** 18n,
    tokensOut: 400n * 10n ** 18n,
    fee: 0n,
    tax: 0n,
  });
  const later = encodeCurveBuyLog({
    buyer: LATER,
    recipient: LATER,
    quoteIn: 5n * 10n ** 18n,
    tokensOut: 400n * 10n ** 18n,
    fee: 0n,
    tax: 0n,
  });
  return [
    {
      address: CURVE,
      topics: launchBuy.topics as Hex[],
      data: launchBuy.data,
      blockNumber: N,
      logIndex: 4,
      transactionHash: LAUNCH_TX,
    },
    {
      address: CURVE,
      topics: snipe.topics as Hex[],
      data: snipe.data,
      blockNumber: N,
      logIndex: 5,
      transactionHash: LAUNCH_TX,
    },
    {
      address: CURVE,
      topics: later.topics as Hex[],
      data: later.data,
      blockNumber: N + 2n,
      logIndex: 0,
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  ];
}

class MemoryReader implements ChainReader {
  constructor(
    private readonly logs: RpcLog[],
    private readonly launch: LaunchRecord | null,
    private readonly tip: bigint,
  ) {}

  async getBlockNumber(): Promise<bigint> {
    return this.tip;
  }

  async getLogs(query: LogQuery): Promise<RpcLog[]> {
    return this.logs.filter((log) => {
      if (log.address.toLowerCase() !== query.address.toLowerCase()) return false;
      const block = log.blockNumber ?? 0n;
      return block >= query.fromBlock && block <= query.toBlock;
    });
  }

  async getLaunch(): Promise<LaunchRecord | null> {
    return this.launch;
  }
}

function launchRecord(): LaunchRecord {
  return {
    token: TOKEN,
    curve: CURVE,
    pairToken: QUOTE,
    phase: LaunchPhase.NotGraduated,
    exists: true,
    poolFee: 0,
    tickSpacing: 0,
  };
}

function adapter(tip: bigint, logs = backfillLogs()): PonsLaunchAdapter {
  return new PonsLaunchAdapter({
    rpcUrl: "http://127.0.0.1:0",
    tokenAddress: TOKEN,
    curveAddress: CURVE,
    quoteAddress: QUOTE,
    chainId: 4663,
    reader: new MemoryReader(logs, launchRecord(), tip),
  });
}

function ticketRuntime(): BellRuntime {
  return new BellRuntime({
    ...config,
    gmeUsdPrice: 20,
    minBuyUsd: 5,
    ticketsPerUsd: 1000,
  });
}

function memoryPool(seed?: { adapter: string; last: string; start: string }): Pool {
  const events = new Set<string>();
  const cursors = new Map<string, { last: string; start: string | null }>();
  if (seed) {
    cursors.set(seed.adapter, { last: seed.last, start: seed.start });
  }

  const query = async (sql: string, params?: unknown[]) => {
    const text = sql.replace(/\s+/g, " ");
    if (
      text.includes("BEGIN") ||
      text.includes("COMMIT") ||
      text.includes("ROLLBACK")
    ) {
      return { rowCount: 0, rows: [] };
    }
    if (text.includes("FROM indexer_cursor WHERE adapter")) {
      const row = cursors.get(String(params?.[0]));
      if (!row) return { rows: [] };
      return {
        rows: [{ last_block: row.last, start_block: row.start }],
      };
    }
    if (text.includes("INSERT INTO indexer_cursor")) {
      const name = String(params?.[0]);
      const last = String(params?.[1]);
      const prev = cursors.get(name);
      const start =
        params?.[2] !== undefined ? String(params[2]) : (prev?.start ?? null);
      const updateStart = text.includes("start_block = EXCLUDED.start_block");
      if (!prev) {
        cursors.set(name, { last, start });
      } else {
        cursors.set(name, {
          last,
          start: updateStart ? start : prev.start,
        });
      }
      return { rowCount: 1, rows: [] };
    }
    if (text.includes("INSERT INTO ingested_events")) {
      const id = String(params?.[0]);
      if (events.has(id)) return { rowCount: 0, rows: [] };
      events.add(id);
      return { rowCount: 1, rows: [{ event_id: id }] };
    }
    throw new Error(`unexpected sql: ${text.slice(0, 80)}`);
  };

  return {
    query,
    connect: async () => ({
      query,
      release: () => undefined,
    }),
  } as unknown as Pool;
}

describe("cursor backfill helpers", () => {
  it("seeds START_BLOCK-1, including block 0 launchAndBuy", () => {
    expect(cursorSeed(N)).toBe(N - 1n);
    expect(cursorSeed(0n)).toBe(-1n);
    expect(mergeCursor(N, null)).toBe(N - 1n);
    expect(mergeCursor(N, 2000n)).toBe(N - 1n);
    expect(mergeCursor(N, 50n)).toBe(50n);
  });

  it("rewinds only when START_BLOCK is new or lowered", () => {
    expect(
      bootCursor({ startBlock: N, existingLast: null, existingStart: null }),
    ).toBe(N - 1n);
    expect(
      bootCursor({
        startBlock: N,
        existingLast: TIP,
        existingStart: TIP,
      }),
    ).toBe(N - 1n);
    expect(
      bootCursor({
        startBlock: N,
        existingLast: TIP,
        existingStart: N,
      }),
    ).toBe(TIP);
  });
});

describe("late-start backfill ingest", () => {
  it("indexer starts at tip N+k and still ingests launchAndBuy from N", async () => {
    const runtime = ticketRuntime();
    const indexer = new IndexerService(
      memoryPool(),
      runtime,
      [adapter(TIP)],
      N,
    );
    await indexer.ensureCursors();
    await indexer.pollOnce();
    expect(getWallet(runtime.live, FOUNDATION).tickets).toBe(200_000);
    expect(getWallet(runtime.live, SNIPER).tickets).toBe(100_000);
    expect(getWallet(runtime.live, LATER).tickets).toBe(100_000);
    expect(totalTickets(runtime.live)).toBe(400_000);
  });

  it("rewinds a tip cursor when START_BLOCK is lowered to the deploy block", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = ticketRuntime();
    const indexer = new IndexerService(
      memoryPool({ adapter: "pons-launch", last: TIP.toString(), start: TIP.toString() }),
      runtime,
      [adapter(TIP)],
      N,
    );
    await indexer.ensureCursors();
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/rewound/);
    spy.mockRestore();
    await indexer.pollOnce();
    expect(totalTickets(runtime.live)).toBe(400_000);
    expect(getWallet(runtime.live, FOUNDATION).tickets).toBe(200_000);
  });

  it("misses launchAndBuy only when START_BLOCK is after the deploy block", async () => {
    const runtime = ticketRuntime();
    const indexer = new IndexerService(
      memoryPool(),
      runtime,
      [adapter(TIP)],
      N + 1n,
    );
    await indexer.ensureCursors();
    await indexer.pollOnce();
    expect(getWallet(runtime.live, FOUNDATION).tickets).toBe(0);
    expect(getWallet(runtime.live, SNIPER).tickets).toBe(0);
    expect(getWallet(runtime.live, LATER).tickets).toBe(100_000);
    expect(totalTickets(runtime.live)).toBe(100_000);
  });

  it("keeps the process up and does not move the cursor when a poll throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const runtime = ticketRuntime();
    const pool = memoryPool({
      adapter: "pons-launch",
      last: TIP.toString(),
      start: N.toString(),
    });
    const updates: string[] = [];
    const original = pool.query.bind(pool);
    pool.query = (async (sql: string, params?: unknown[]) => {
      if (String(sql).includes("INSERT INTO indexer_cursor")) {
        updates.push(String(params?.[1]));
      }
      return original(sql, params);
    }) as typeof pool.query;
    const indexer = new IndexerService(
      pool,
      runtime,
      [
        {
          name: "pons-launch",
          async fetchTrades() {
            throw new Error("indexer RPC HTTP 400 block range");
          },
        },
      ],
      N,
    );
    await expect(indexer.pollOnce()).resolves.toBeUndefined();
    expect(updates).toEqual([]);
    expect(String(spy.mock.calls.at(-1)?.[0])).toMatch(/cursor unchanged/);
    spy.mockRestore();
  });
});
