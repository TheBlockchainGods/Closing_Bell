import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { parseEther, type Hex } from "viem";

import {
  encodeCurveBuyLog,
  encodeCurveBuyRefundedLog,
  encodeCurveSellLog,
  encodeUv4SwapLog,
} from "../src/indexer/encode-log.js";
import { LaunchPhase } from "../src/indexer/abi.js";
import {
  bootCursor,
  cursorSeed,
  rpcFromBlock,
} from "../src/indexer/cursor.js";
import {
  computePoolId,
  decodePonsCurveLog,
  decodePonsCurveLogs,
  decodeUniswapV4SwapLog,
  tokenIsCurrency0,
} from "../src/indexer/decode.js";
import { PonsLaunchAdapter } from "../src/indexer/adapters/pons-launch.js";
import type { ChainReader, LaunchRecord, LogQuery, RpcLog } from "../src/indexer/rpc.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { config } from "../src/config.js";
import { getWallet, totalTickets } from "../src/tickets/engine.js";
import { skipRingReason } from "../src/keeper/skip.js";
import { formatSkip, formatWinCelebration } from "../src/telegram/format.js";
import { computePotDisplay } from "../src/pot/display.js";

const here = dirname(fileURLToPath(import.meta.url));

interface CurveFixture {
  quoteDecimals: number;
  tokenDecimals: number;
  curve: Hex;
  gmeUsdPrice: number;
  minBuyUsd: number;
  ticketsPerUsd: number;
  events: Array<{
    event: "CurveBuy" | "CurveSell";
    blockNumber: number;
    logIndex: number;
    txHash: Hex;
    buyer?: Hex;
    seller?: Hex;
    recipient: Hex;
    quoteInWei?: string;
    tokensOutWei?: string;
    tokensInWei?: string;
    quoteOutWei?: string;
    feeWei: string;
    taxWei: string;
  }>;
}

interface Uv4Fixture {
  token: Hex;
  quote: Hex;
  fee: number;
  tickSpacing: number;
  hooks: Hex;
  gmeUsdPrice: number;
  minBuyUsd: number;
  ticketsPerUsd: number;
  events: Array<{
    event: "Swap";
    blockNumber: number;
    logIndex: number;
    txHash: Hex;
    sender: Hex;
    tokenDeltaWei: string;
    quoteDeltaWei: string;
  }>;
}

function loadCurve(): CurveFixture {
  return JSON.parse(
    readFileSync(resolve(here, "../fixtures/pons-curve-logs.json"), "utf8"),
  ) as CurveFixture;
}

function loadUv4(): Uv4Fixture {
  return JSON.parse(
    readFileSync(resolve(here, "../fixtures/uv4-swap-logs.json"), "utf8"),
  ) as Uv4Fixture;
}

function encodeCurveRow(curve: Hex, row: CurveFixture["events"][0]): RpcLog {
  if (row.event === "CurveBuy") {
    const encoded = encodeCurveBuyLog({
      buyer: row.buyer as Hex,
      recipient: row.recipient,
      quoteIn: BigInt(row.quoteInWei!),
      tokensOut: BigInt(row.tokensOutWei!),
      fee: BigInt(row.feeWei),
      tax: BigInt(row.taxWei),
    });
    return {
      address: curve,
      topics: encoded.topics as Hex[],
      data: encoded.data,
      blockNumber: BigInt(row.blockNumber),
      logIndex: row.logIndex,
      transactionHash: row.txHash,
    };
  }
  const encoded = encodeCurveSellLog({
    seller: row.seller as Hex,
    recipient: row.recipient,
    tokensIn: BigInt(row.tokensInWei!),
    quoteOut: BigInt(row.quoteOutWei!),
    fee: BigInt(row.feeWei),
    tax: BigInt(row.taxWei),
  });
  return {
    address: curve,
    topics: encoded.topics as Hex[],
    data: encoded.data,
    blockNumber: BigInt(row.blockNumber),
    logIndex: row.logIndex,
    transactionHash: row.txHash,
  };
}

function encodeUv4Row(
  poolManager: Hex,
  poolId: Hex,
  tokenIsC0: boolean,
  row: Uv4Fixture["events"][0],
): RpcLog {
  const tokenDelta = BigInt(row.tokenDeltaWei);
  const quoteDelta = BigInt(row.quoteDeltaWei);
  const amount0 = tokenIsC0 ? tokenDelta : quoteDelta;
  const amount1 = tokenIsC0 ? quoteDelta : tokenDelta;
  const encoded = encodeUv4SwapLog({
    id: poolId,
    sender: row.sender,
    amount0,
    amount1,
  });
  return {
    address: poolManager,
    topics: encoded.topics as Hex[],
    data: encoded.data,
    blockNumber: BigInt(row.blockNumber),
    logIndex: row.logIndex,
    transactionHash: row.txHash,
  };
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
    const wantId =
      query.args && "id" in query.args && query.args.id
        ? String(query.args.id).toLowerCase()
        : null;
    return this.logs.filter((log) => {
      if (log.address.toLowerCase() !== query.address.toLowerCase()) return false;
      const block = log.blockNumber ?? 0n;
      if (block < query.fromBlock || block > query.toBlock) return false;
      if (wantId && (log.topics[1] ?? "").toLowerCase() !== wantId) return false;
      return true;
    });
  }

  async getLaunch(): Promise<LaunchRecord | null> {
    return this.launch;
  }
}

describe("cursor backfill seed", () => {
  it("seeds START_BLOCK-1 so the deploy block is included", () => {
    expect(cursorSeed(100n)).toBe(99n);
    expect(cursorSeed(0n)).toBe(-1n);
    expect(rpcFromBlock(-1n)).toBe(0n);
    expect(rpcFromBlock(99n)).toBe(100n);
    expect(
      bootCursor({
        startBlock: 100n,
        existingLast: 110n,
        existingStart: 110n,
      }),
    ).toBe(99n);
  });
});

describe("PONS CurveBuy / CurveSell decode", () => {
  const tape = loadCurve();

  it("decodes recorded logs into ticket mint and burn", () => {
    const logs = tape.events.map((row) => encodeCurveRow(tape.curve, row));
    const trades = decodePonsCurveLogs(logs, {
      quoteDecimals: 18,
      tokenDecimals: 18,
    });
    expect(trades).toHaveLength(3);
    expect(trades[0]).toMatchObject({
      kind: "buy",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      gmeAmount: 10,
      bellAmount: 1000,
      adapter: "pons-curve",
    });
    expect(trades[0].eventId).toBe(`${tape.events[0].txHash}:${tape.events[0].logIndex}`);
    expect(trades[2]).toMatchObject({
      kind: "sell",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      gmeAmount: 2,
      bellAmount: 200,
    });

    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: tape.gmeUsdPrice,
      minBuyUsd: tape.minBuyUsd,
      ticketsPerUsd: tape.ticketsPerUsd,
    });
    for (const trade of trades) runtime.applyEvent(trade);
    const alice = getWallet(runtime.live, tape.events[0].recipient);
    expect(alice.tickets).toBe(160_000);
    expect(alice.bellBalance).toBe(800);
    expect(totalTickets(runtime.live)).toBe(160_000 + 100_000);
  });

  it("ignores CurveBuyRefunded", () => {
    const encoded = encodeCurveBuyRefundedLog({
      buyer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      refundedQuote: parseEther("1"),
    });
    expect(
      decodePonsCurveLog({
        address: tape.curve,
        topics: encoded.topics as Hex[],
        data: encoded.data,
        blockNumber: 100n,
        logIndex: 9,
        transactionHash:
          "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      }),
    ).toBeNull();
  });
});

describe("Uniswap v4 Swap decode", () => {
  const tape = loadUv4();
  const poolManager = "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Hex;
  const poolId = computePoolId({
    token: tape.token,
    quote: tape.quote,
    fee: tape.fee,
    tickSpacing: tape.tickSpacing,
    hooks: tape.hooks,
  });
  const tokenIsC0 = tokenIsCurrency0(tape.token, tape.quote);

  it("maps a BELL buy against GME into tickets, then burns on sell", () => {
    const logs = tape.events.map((row) =>
      encodeUv4Row(poolManager, poolId, tokenIsC0, row),
    );
    const buy = decodeUniswapV4SwapLog(logs[0], {
      tokenAddress: tape.token,
      quoteAddress: tape.quote,
      tokenIsCurrency0: tokenIsC0,
    });
    const sell = decodeUniswapV4SwapLog(logs[1], {
      tokenAddress: tape.token,
      quoteAddress: tape.quote,
      tokenIsCurrency0: tokenIsC0,
    });
    expect(buy).toMatchObject({
      kind: "buy",
      wallet: tape.events[0].sender.toLowerCase(),
      gmeAmount: 8,
      bellAmount: 800,
      adapter: "uniswap-v4",
    });
    expect(buy?.eventId).toBe(`${tape.events[0].txHash}:${tape.events[0].logIndex}`);
    expect(sell).toMatchObject({
      kind: "sell",
      wallet: tape.events[1].sender.toLowerCase(),
      gmeAmount: 2,
      bellAmount: 200,
    });

    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: tape.gmeUsdPrice,
      minBuyUsd: tape.minBuyUsd,
      ticketsPerUsd: tape.ticketsPerUsd,
    });
    runtime.applyEvent(buy!);
    expect(getWallet(runtime.live, tape.events[0].sender).tickets).toBe(160_000);
    runtime.applyEvent(sell!);
    const dave = getWallet(runtime.live, tape.events[0].sender);
    expect(dave.tickets).toBe(120_000);
    expect(dave.bellBalance).toBe(600);
  });
});

describe("late-start backfill", () => {
  it("still ingests START_BLOCK trades when the indexer comes up after launch", async () => {
    const tape = loadCurve();
    const logs = tape.events.map((row) => encodeCurveRow(tape.curve, row));
    const token = "0x2222222222222222222222222222222222222222" as Hex;
    const quote = "0x3333333333333333333333333333333333333333" as Hex;
    const launch: LaunchRecord = {
      token,
      curve: tape.curve,
      pairToken: quote,
      phase: LaunchPhase.NotGraduated,
      exists: true,
      poolFee: 0,
      tickSpacing: 0,
    };
    const startBlock = 100n;
    const reader = new MemoryReader(logs, launch, 110n);
    const adapter = new PonsLaunchAdapter({
      rpcUrl: "http://127.0.0.1:0",
      tokenAddress: token,
      curveAddress: tape.curve,
      quoteAddress: quote,
      chainId: 4663,
      reader,
    });
    const seeded = cursorSeed(startBlock);
    const { trades, tipBlock } = await adapter.fetchTrades(seeded);
    expect(seeded).toBe(99n);
    expect(tipBlock).toBe(110n);
    expect(trades.map((t) => Number(t.blockNumber))).toEqual([100, 101, 102]);
    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: tape.gmeUsdPrice,
      minBuyUsd: tape.minBuyUsd,
      ticketsPerUsd: tape.ticketsPerUsd,
    });
    for (const trade of trades) runtime.applyEvent(trade);
    expect(totalTickets(runtime.live)).toBe(260_000);
  });

  it("does not silently return [] while NotGraduated if logs exist", async () => {
    const tape = loadCurve();
    const logs = tape.events.map((row) => encodeCurveRow(tape.curve, row));
    const token = "0x2222222222222222222222222222222222222222" as Hex;
    const adapter = new PonsLaunchAdapter({
      rpcUrl: "http://127.0.0.1:0",
      tokenAddress: token,
      curveAddress: tape.curve,
      quoteAddress: "0x3333333333333333333333333333333333333333",
      chainId: 4663,
      reader: new MemoryReader(logs, null, 110n),
    });
    const { trades } = await adapter.fetchTrades(99n);
    expect(trades.length).toBeGreaterThan(0);
  });

  it("switches to UV4 after PoolCreated, keeps curve tickets, no double-count", async () => {
    const curveTape = loadCurve();
    const uv4 = loadUv4();
    const poolManager = "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Hex;
    const poolId = computePoolId({
      token: uv4.token,
      quote: uv4.quote,
      fee: uv4.fee,
      tickSpacing: uv4.tickSpacing,
      hooks: uv4.hooks,
    });
    const tokenIsC0 = tokenIsCurrency0(uv4.token, uv4.quote);
    const logs = [
      ...curveTape.events.map((row) => encodeCurveRow(curveTape.curve, row)),
      ...uv4.events.map((row) =>
        encodeUv4Row(poolManager, poolId, tokenIsC0, row),
      ),
    ];
    const launchPool: LaunchRecord = {
      token: uv4.token,
      curve: curveTape.curve,
      pairToken: uv4.quote,
      phase: LaunchPhase.PoolCreated,
      exists: true,
      poolFee: uv4.fee,
      tickSpacing: uv4.tickSpacing,
    };
    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: curveTape.gmeUsdPrice,
      minBuyUsd: curveTape.minBuyUsd,
      ticketsPerUsd: curveTape.ticketsPerUsd,
    });

    const curveAdapter = new PonsLaunchAdapter({
      rpcUrl: "http://127.0.0.1:0",
      tokenAddress: uv4.token,
      curveAddress: curveTape.curve,
      quoteAddress: uv4.quote,
      chainId: 4663,
      hookAddress: uv4.hooks,
      poolManager,
      reader: new MemoryReader(
        logs,
        { ...launchPool, phase: LaunchPhase.NotGraduated },
        110n,
      ),
    });
    const { trades: curveTrades } = await curveAdapter.fetchTrades(99n);
    expect(curveTrades.every((t) => t.adapter === "pons-curve")).toBe(true);
    for (const trade of curveTrades) runtime.applyEvent(trade);
    expect(totalTickets(runtime.live)).toBe(260_000);

    const sweptAdapter = new PonsLaunchAdapter({
      rpcUrl: "http://127.0.0.1:0",
      tokenAddress: uv4.token,
      curveAddress: curveTape.curve,
      quoteAddress: uv4.quote,
      chainId: 4663,
      hookAddress: uv4.hooks,
      poolManager,
      reader: new MemoryReader(
        logs,
        { ...launchPool, phase: LaunchPhase.Swept },
        150n,
      ),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { trades: sweptTrades } = await sweptAdapter.fetchTrades(102n);
    expect(sweptTrades).toEqual([]);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/Swept/);
    spy.mockRestore();
    expect(totalTickets(runtime.live)).toBe(260_000);

    const poolAdapter = new PonsLaunchAdapter({
      rpcUrl: "http://127.0.0.1:0",
      tokenAddress: uv4.token,
      curveAddress: curveTape.curve,
      quoteAddress: uv4.quote,
      chainId: 4663,
      hookAddress: uv4.hooks,
      poolManager,
      reader: new MemoryReader(logs, launchPool, 210n),
    });
    const { trades: poolTrades } = await poolAdapter.fetchTrades(102n);
    expect(poolTrades.every((t) => t.adapter === "uniswap-v4")).toBe(true);
    expect(poolTrades.map((t) => t.kind)).toEqual(["buy", "sell"]);
    for (const trade of poolTrades) runtime.applyEvent(trade);
    expect(getWallet(runtime.live, curveTape.events[0].recipient).tickets).toBe(
      160_000,
    );
    expect(getWallet(runtime.live, uv4.events[0].sender).tickets).toBe(120_000);
    expect(totalTickets(runtime.live)).toBe(380_000);

    const overlap = await poolAdapter.fetchTrades(99n);
    const ids = overlap.trades.map((t) => t.eventId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(overlap.trades.filter((t) => t.adapter === "pons-curve")).toHaveLength(3);
    expect(overlap.trades.filter((t) => t.adapter === "uniswap-v4")).toHaveLength(2);
  });
});

describe("empty pot skip", () => {
  it("skips when display pot is 0 and does not format a win pin", () => {
    const pot = computePotDisplay({
      jackpotWalletBalance: 0,
      ponsClaimable: 0,
      jackpotShareBps: 2000,
      gmeUsdPrice: 23.18,
    });
    expect(pot.displayPot).toBe(0);
    expect(
      skipRingReason({ potGme: pot.displayPot, minPotGme: 1, totalWeight: 10 }),
    ).toMatch(/MIN_POT_GME/);
    const skip = formatSkip({
      bellLabel: "Close Bell",
      reason: "pot 0 GME < MIN_POT_GME 1",
      potGme: 0,
    });
    expect(skip).toContain("RING SKIPPED");
    expect(skip).not.toContain("WIN CELEBRATION");
    const win = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
      amountGme: 10,
      amountUsd: 200,
      dryRun: true,
      txHash: null,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(win).toContain("none (dry-run, no GME sent)");
  });
});
