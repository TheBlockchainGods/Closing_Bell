import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/client.js", () => ({
  getPool: () => ({
    query: async () => ({ rows: [], rowCount: 1 }),
  }),
}));
import type { Pool } from "pg";
import type { Hex } from "viem";

import {
  KNOWN_ROUTER_DENYLIST,
  codeIsContract,
  EoaGate,
} from "../src/chain/eoa-gate.js";
import { config } from "../src/config.js";
import { nextBell } from "../src/clock/market-clock.js";
import { IndexerService } from "../src/indexer/service.js";
import type { ChainTradeEvent } from "../src/indexer/types.js";
import { DrawKeeper } from "../src/keeper/draw-keeper.js";
import { sendJackpotPayout } from "../src/keeper/payout.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import type { TelegramBot } from "../src/telegram/bot.js";
import { getWallet, totalTickets } from "../src/tickets/engine.js";
import { buildServer } from "../src/api/server.js";

const ROUTER_7 = "0x7Ab338fdE039fEB0da5a38d90D1A08fFf1C31aF0";
const ROUTER_10 = "0x8F10B468b06c6FD214B65F87778827F7D113f996";
const ROUTER_650 = "0x65050A9b7E5075A2bA5cED7b1b64EE66262c40Dc";
const SNIPER = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137";
const BYTECODE = "0x608060405234801561001057600080fd5b50";
const TX =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;

const ANVIL_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function memoryIngestPool(): Pool {
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
        throw new Error(`unexpected sql: ${text.slice(0, 80)}`);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
}

type DrawRow = Record<string, unknown>;

function memoryDrawPool(): { pool: Pool; draws: Map<string, DrawRow> } {
  const draws = new Map<string, DrawRow>();
  const winners = new Map<string, DrawRow>();
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
      const row: DrawRow = {
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
  return { pool: { query } as unknown as Pool, draws };
}

function fakeBot(): TelegramBot {
  return {
    send: async () => undefined,
    announceWin: async () => undefined,
  } as unknown as TelegramBot;
}

function buyEvent(
  wallet: string,
  gmeAmount: number,
  extras?: Partial<ChainTradeEvent>,
): ChainTradeEvent {
  return {
    eventId: extras?.eventId ?? `${wallet}:${gmeAmount}:${Math.random()}`,
    adapter: "fixture",
    txHash: extras?.txHash ?? TX,
    logIndex: extras?.logIndex ?? 0,
    blockNumber: extras?.blockNumber ?? 1n,
    kind: "buy",
    wallet,
    gmeAmount,
    bellAmount: gmeAmount * 1000,
    occurredAt: extras?.occurredAt ?? new Date(),
  };
}

function gateWithCode(opts?: {
  txFrom?: string | null;
  extraCode?: Record<string, string>;
}): EoaGate {
  const extra = opts?.extraCode ?? {};
  return new EoaGate(
    async (address) => {
      const key = address.toLowerCase();
      if (KNOWN_ROUTER_DENYLIST.includes(key) || extra[key]) {
        return extra[key] ?? BYTECODE;
      }
      return "0x";
    },
    async () => opts?.txFrom ?? null,
  );
}

describe("codeIsContract", () => {
  it("treats empty bytecode as EOA", () => {
    expect(codeIsContract("0x")).toBe(false);
    expect(codeIsContract("0x0")).toBe(false);
    expect(codeIsContract("")).toBe(false);
    expect(codeIsContract(null)).toBe(false);
  });

  it("treats any bytecode as CONTRACT", () => {
    expect(codeIsContract(BYTECODE)).toBe(true);
  });
});

describe("EoaGate getCode + denylist", () => {
  it("flags known routers as CONTRACT and a sniper as EOA", async () => {
    const gate = gateWithCode();
    expect(await gate.isContract(ROUTER_7)).toBe(true);
    expect(await gate.isContract(ROUTER_10)).toBe(true);
    expect(await gate.isContract(ROUTER_650)).toBe(true);
    expect(await gate.isContract(SNIPER)).toBe(false);
  });

  it("caches getCode briefly", async () => {
    let hits = 0;
    const gate = new EoaGate(
      async () => {
        hits += 1;
        return "0x";
      },
      null,
      { ttlMs: 30_000 },
    );
    await gate.isContract(SNIPER);
    await gate.isContract(SNIPER);
    expect(hits).toBe(1);
  });
});

describe("ticket credit unwrap or skip", () => {
  it("unwraps a #7 router fill onto the signed EOA", async () => {
    const gate = gateWithCode({ txFrom: SNIPER });
    const runtime = new BellRuntime(config);
    runtime.attachEoaGate(gate);
    const indexer = new IndexerService(
      memoryIngestPool(),
      runtime,
      [],
      0n,
      gate,
    );
    await indexer.ingest(buyEvent(ROUTER_7, 10, { txHash: TX }));
    expect(getWallet(runtime.live, ROUTER_7).tickets).toBe(0);
    expect(getWallet(runtime.live, SNIPER).tickets).toBeGreaterThan(0);
    expect(gate.stats().unwraps).toBe(1);
    expect(gate.stats().skips).toBe(0);
  });

  it("unwraps a #10 router fill onto the signed EOA", async () => {
    const gate = gateWithCode({ txFrom: SNIPER });
    const runtime = new BellRuntime(config);
    runtime.attachEoaGate(gate);
    const indexer = new IndexerService(
      memoryIngestPool(),
      runtime,
      [],
      0n,
      gate,
    );
    await indexer.ingest(buyEvent(ROUTER_10, 10, { txHash: TX }));
    expect(getWallet(runtime.live, ROUTER_10).tickets).toBe(0);
    expect(getWallet(runtime.live, SNIPER).tickets).toBeGreaterThan(0);
  });

  it("skips when the recipient is a contract and tx.from is not a safe EOA", async () => {
    const gate = gateWithCode({ txFrom: ROUTER_650 });
    const runtime = new BellRuntime(config);
    runtime.attachEoaGate(gate);
    const indexer = new IndexerService(
      memoryIngestPool(),
      runtime,
      [],
      0n,
      gate,
    );
    await indexer.ingest(buyEvent(ROUTER_7, 10));
    expect(getWallet(runtime.live, ROUTER_7).tickets).toBe(0);
    expect(totalTickets(runtime.live)).toBe(0);
    expect(gate.stats().skips).toBe(1);
  });

  it("hides denylisted routers from the ladder", () => {
    const gate = new EoaGate(null);
    const runtime = new BellRuntime(config);
    runtime.attachEoaGate(gate);
    runtime.applyEvent(buyEvent(ROUTER_7, 10));
    runtime.applyEvent(buyEvent(SNIPER, 10));
    const ladder = runtime.ladder(10);
    expect(ladder.some((row) => row.address === ROUTER_7.toLowerCase())).toBe(
      false,
    );
    expect(ladder.some((row) => row.address === SNIPER.toLowerCase())).toBe(
      true,
    );
    expect(runtime.oddsFor(ROUTER_7).tickets).toBe(0);
  });
});

describe("jackpot refuses contract winners", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters the draw bag to EOAs before the weighted walk", async () => {
    const at = nextBell(new Date("2026-09-18T00:00:00.000Z"), config.bells24_7)!
      .at;
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: 20,
      jackpotWalletBalanceGme: 500,
      ponsClaimableGme: 0,
    });
    runtime.applyEvent(buyEvent(ROUTER_7, 50, { occurredAt: at }));
    runtime.applyEvent(buyEvent(SNIPER, 10, { occurredAt: at }));
    expect(getWallet(runtime.live, ROUTER_7).tickets).toBeGreaterThan(0);

    const gate = gateWithCode();
    runtime.attachEoaGate(gate);
    const book = await runtime.eligibleTicketBook();
    expect(book.has(ROUTER_7.toLowerCase())).toBe(false);
    expect(book.has(SNIPER.toLowerCase())).toBe(true);

    const { pool, draws } = memoryDrawPool();
    const keeper = new DrawKeeper(pool, runtime, fakeBot(), async () => {
      throw new Error("payout must not be sent in dry run");
    });
    await keeper.tick();
    const row = [...draws.values()][0];
    expect(row?.phase).toBe("dry_run");
    expect(String(row?.winner).toLowerCase()).toBe(SNIPER.toLowerCase());
  });

  it("skips the ring when every ticket holder is a contract", async () => {
    const at = nextBell(new Date("2026-09-18T00:00:00.000Z"), config.bells24_7)!
      .at;
    vi.useFakeTimers();
    vi.setSystemTime(at);

    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: 20,
      jackpotWalletBalanceGme: 500,
      ponsClaimableGme: 0,
    });
    runtime.applyEvent(buyEvent(ROUTER_7, 10, { occurredAt: at }));
    const gate = gateWithCode();
    runtime.attachEoaGate(gate);

    const { pool, draws } = memoryDrawPool();
    const keeper = new DrawKeeper(pool, runtime, fakeBot(), async () => {
      throw new Error("payout must not be sent in dry run");
    });
    await keeper.tick();
    const row = [...draws.values()][0];
    expect(row?.phase).toBe("skipped");
    expect(String(row?.skip_reason)).toBe("empty bag");
    expect(gate.stats().drawSkips).toBeGreaterThan(0);
    expect(row?.winner).toBeNull();
  });

  it("does not send GME to a contract winner", async () => {
    const gate = gateWithCode();
    const writeContract = vi.fn(async () => TX);
    await expect(
      sendJackpotPayout(
        { winner: ROUTER_7 as `0x${string}`, amountGme: 10 },
        {
          publicClient: {
            readContract: async () => 18,
            waitForTransactionReceipt: async () => ({ status: "success" }),
          },
          walletClient: { writeContract },
          config: {
            jackpotPrivateKey: ANVIL_KEY,
            jackpotWallet: ANVIL_WALLET,
            gmeTokenAddress: "0x2222222222222222222222222222222222222222",
            rpcUrl: "http://127.0.0.1:8545",
            chainId: 4663,
            payoutGasLimit: null,
            gmeTokenDecimals: 18,
          },
          assertEoaWinner: (address) => gate.assertEoaWinner(address),
        },
      ),
    ).rejects.toThrow(/contract/i);
    expect(writeContract).not.toHaveBeenCalled();
    expect(gate.stats().skips).toBe(1);
  });

});

describe("/health contract skips", () => {
  it("exposes skip counts on /health", async () => {
    vi.useRealTimers();
    const gate = gateWithCode({ txFrom: null });
    await gate.creditForTrade({ recipient: ROUTER_7, txHash: TX });
    const runtime = new BellRuntime(config);
    runtime.attachEoaGate(gate);
    const app = buildServer(runtime);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.eoaGate.skips).toBeGreaterThan(0);
    expect(body.eoaGate.denylist).toBeGreaterThanOrEqual(3);
  });
});
