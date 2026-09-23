import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

import { pickCurveAddress, ZERO_ADDRESS } from "../src/indexer/abi.js";
import { PonsCurveAdapter } from "../src/indexer/adapters/pons-curve.js";
import { UniswapV4Adapter } from "../src/indexer/adapters/uniswap-v4.js";
import {
  computePoolId,
  decodeUniswapV4SwapLog,
  tokenIsCurrency0,
} from "../src/indexer/decode.js";
import {
  encodeCurveBuyLog,
  encodeCurveSellLog,
  encodeUv4SwapLog,
} from "../src/indexer/encode-log.js";
import type { ChainReader, LaunchRecord, RpcLog } from "../src/indexer/rpc.js";
import { LaunchPhase } from "../src/indexer/abi.js";
import { buildAdapters, IndexerService } from "../src/indexer/service.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { config } from "../src/config.js";
import { getWallet, totalTickets } from "../src/tickets/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const CURVE = "0x1111111111111111111111111111111111111111" as Hex;
const TOKEN = "0x2222222222222222222222222222222222222222" as Hex;
const QUOTE = "0x3333333333333333333333333333333333333333" as Hex;
const OTHER_QUOTE = "0x4444444444444444444444444444444444444444" as Hex;

interface CurveFixture {
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

function loadCurve(): CurveFixture {
  return JSON.parse(
    readFileSync(resolve(here, "../fixtures/pons-curve-logs.json"), "utf8"),
  ) as CurveFixture;
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

class MemoryReader implements ChainReader {
  constructor(
    private readonly logs: RpcLog[],
    private readonly launch: LaunchRecord | null,
    private readonly tip: bigint,
  ) {}

  async getBlockNumber(): Promise<bigint> {
    return this.tip;
  }

  async getLogs(query: {
    address: Hex;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<RpcLog[]> {
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

describe("prod path stays fixture", () => {
  it("buildAdapters uses FixtureAdapter while FIXTURE_MODE is on", () => {
    if (!config.fixtureMode) return;
    expect(config.tokenAddress).toBe("");
    expect(buildAdapters().map((row) => row.name)).toEqual(["fixture"]);
  });
});

describe("replayAll skips fixture tape when live", () => {
  it("filters adapter=fixture when fixtureMode is false", async () => {
    const sql: string[] = [];
    const pool = {
      query: async (text: string) => {
        sql.push(text);
        return { rows: [] };
      },
    };
    const indexer = new IndexerService(
      pool as never,
      new BellRuntime(config),
      [],
      0n,
    );
    await indexer.replayAll(false);
    expect(sql.at(-1)).toMatch(/adapter <> 'fixture'/);
    await indexer.replayAll(true);
    expect(sql.at(-1)).not.toMatch(/adapter <> 'fixture'/);
  });
});

describe("pickCurveAddress CREATE2 vs factory", () => {
  it("prefers factory curve after launch, else predicted CREATE2, never zero", () => {
    expect(
      pickCurveAddress({
        factoryCurve: CURVE,
        predictedCurve: "0x5555555555555555555555555555555555555555",
      }),
    ).toBe(CURVE);
    expect(
      pickCurveAddress({
        factoryCurve: ZERO_ADDRESS,
        predictedCurve: CURVE,
      }),
    ).toBe(CURVE);
    expect(
      pickCurveAddress({
        factoryCurve: null,
        predictedCurve: ZERO_ADDRESS,
      }),
    ).toBeNull();
  });
});

describe("PonsCurveAdapter fetchTrades", () => {
  const tape = loadCurve();

  it("decodes recorded CurveBuy/CurveSell into mint then burn tickets", async () => {
    const logs = tape.events.map((row) => encodeCurveRow(tape.curve, row));
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: tape.curve,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader: new MemoryReader(logs, null, 110n),
    });
    const { trades } = await adapter.fetchTrades(99n);
    expect(trades).toHaveLength(3);
    expect(trades[0].eventId).toBe(
      `${tape.events[0].txHash}:${tape.events[0].logIndex}`,
    );
    expect(trades[0]).toMatchObject({
      kind: "buy",
      wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      gmeAmount: 10,
      bellAmount: 1000,
      adapter: "pons-curve",
    });
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
    expect(totalTickets(runtime.live)).toBe(260_000);
  });

  it("watches the CREATE2 predicted curve when getLaunchedToken is empty", async () => {
    const encoded = encodeCurveBuyLog({
      buyer: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1",
      recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      quoteIn: 10n * 10n ** 18n,
      tokensOut: 1000n * 10n ** 18n,
      fee: 0n,
      tax: 0n,
    });
    const log: RpcLog = {
      address: CURVE,
      topics: encoded.topics as Hex[],
      data: encoded.data,
      blockNumber: 50n,
      logIndex: 3,
      transactionHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: CURVE,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader: new MemoryReader([log], null, 50n),
    });
    const { trades } = await adapter.fetchTrades(49n);
    expect(trades).toHaveLength(1);
    expect(trades[0].eventId).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:3",
    );
    expect(trades[0].kind).toBe("buy");
  });

  it("resolves curve via factory getLaunchedToken when CURVE_OR_POOL is unset", async () => {
    const encoded = encodeCurveBuyLog({
      buyer: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1",
      recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      quoteIn: 5n * 10n ** 18n,
      tokensOut: 400n * 10n ** 18n,
      fee: 0n,
      tax: 0n,
    });
    const log: RpcLog = {
      address: CURVE,
      topics: encoded.topics as Hex[],
      data: encoded.data,
      blockNumber: 60n,
      logIndex: 1,
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    const launch: LaunchRecord = {
      token: TOKEN,
      curve: CURVE,
      pairToken: QUOTE,
      phase: LaunchPhase.NotGraduated,
      exists: true,
      poolFee: 0,
      tickSpacing: 0,
    };
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: ZERO_ADDRESS,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader: new MemoryReader([log], launch, 60n),
    });
    const { trades } = await adapter.fetchTrades(59n);
    expect(trades).toHaveLength(1);
    expect(trades[0].gmeAmount).toBe(5);
    expect(trades[0].wallet).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
    );
  });

  it("warns loudly when live fetchTrades would return empty", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: CURVE,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader: new MemoryReader([], null, 80n),
    });
    const { trades } = await adapter.fetchTrades(70n);
    expect(trades).toEqual([]);
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/no CurveBuy\/CurveSell/);
    spy.mockRestore();
  });

  it("warns when factory pairToken is not the configured GME quote", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const launch: LaunchRecord = {
      token: TOKEN,
      curve: CURVE,
      pairToken: OTHER_QUOTE,
      phase: LaunchPhase.NotGraduated,
      exists: true,
      poolFee: 0,
      tickSpacing: 0,
    };
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: ZERO_ADDRESS,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader: new MemoryReader([], launch, 10n),
    });
    await adapter.fetchTrades(0n);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/pairToken/);
    spy.mockRestore();
  });
});

describe("live venue adapters", () => {
  it("PonsCurveAdapter decodes CurveBuy via injected reader", async () => {
    const encoded = encodeCurveBuyLog({
      buyer: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1",
      recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      quoteIn: 10n * 10n ** 18n,
      tokensOut: 1000n * 10n ** 18n,
      fee: 0n,
      tax: 0n,
    });
    const log: RpcLog = {
      address: CURVE,
      topics: encoded.topics as Hex[],
      data: encoded.data,
      blockNumber: 50n,
      logIndex: 0,
      transactionHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    const reader: ChainReader = {
      getBlockNumber: async () => 50n,
      getLogs: async () => [log],
      getLaunch: async () => null,
    };
    const adapter = new PonsCurveAdapter({
      rpcUrl: "http://127.0.0.1:0",
      curveAddress: CURVE,
      tokenAddress: TOKEN,
      chainId: 4663,
      reader,
    });
    const { trades } = await adapter.fetchTrades(49n);
    expect(trades).toHaveLength(1);
    expect(trades[0].kind).toBe("buy");
    expect(trades[0].gmeAmount).toBe(10);
    expect(trades[0].wallet).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
    );
  });

  it("UniswapV4Adapter decodes a mocked Swap", async () => {
    const hooks = "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as Hex;
    const poolId = computePoolId({
      token: TOKEN,
      quote: QUOTE,
      fee: 0,
      tickSpacing: 60,
      hooks,
    });
    const tokenIsC0 = tokenIsCurrency0(TOKEN, QUOTE);
    const tokenDelta = 100n * 10n ** 18n;
    const quoteDelta = -5n * 10n ** 18n;
    const encoded = encodeUv4SwapLog({
      id: poolId,
      sender: "0xddddddddddddddddddddddddddddddddddddddd1",
      amount0: tokenIsC0 ? tokenDelta : quoteDelta,
      amount1: tokenIsC0 ? quoteDelta : tokenDelta,
    });
    const log: RpcLog = {
      address: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
      topics: encoded.topics as Hex[],
      data: encoded.data,
      blockNumber: 80n,
      logIndex: 1,
      transactionHash:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    };
    expect(
      decodeUniswapV4SwapLog(log, {
        tokenAddress: TOKEN,
        quoteAddress: QUOTE,
        tokenIsCurrency0: tokenIsC0,
      })?.kind,
    ).toBe("buy");
    const reader: ChainReader = {
      getBlockNumber: async () => 80n,
      getLogs: async () => [log],
      getLaunch: async () => null,
    };
    const adapter = new UniswapV4Adapter({
      rpcUrl: "http://127.0.0.1:0",
      poolOrHook: hooks,
      tokenAddress: TOKEN,
      quoteAddress: QUOTE,
      chainId: 4663,
      reader,
    });
    const { trades } = await adapter.fetchTrades(79n);
    expect(trades).toHaveLength(1);
    expect(trades[0].adapter).toBe("uniswap-v4");
    expect(trades[0].gmeAmount).toBe(5);
  });

  it("UniswapV4Adapter fixture buy then sell mint and burn tickets", async () => {
    const tape = JSON.parse(
      readFileSync(resolve(here, "../fixtures/uv4-swap-logs.json"), "utf8"),
    ) as {
      token: Hex;
      quote: Hex;
      fee: number;
      tickSpacing: number;
      hooks: Hex;
      gmeUsdPrice: number;
      minBuyUsd: number;
      ticketsPerUsd: number;
      events: Array<{
        blockNumber: number;
        logIndex: number;
        txHash: Hex;
        sender: Hex;
        tokenDeltaWei: string;
        quoteDeltaWei: string;
      }>;
    };
    const poolManager = "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Hex;
    const poolId = computePoolId({
      token: tape.token,
      quote: tape.quote,
      fee: tape.fee,
      tickSpacing: tape.tickSpacing,
      hooks: tape.hooks,
    });
    const tokenIsC0 = tokenIsCurrency0(tape.token, tape.quote);
    const logs: RpcLog[] = tape.events.map((row) => {
      const tokenDelta = BigInt(row.tokenDeltaWei);
      const quoteDelta = BigInt(row.quoteDeltaWei);
      const encoded = encodeUv4SwapLog({
        id: poolId,
        sender: row.sender,
        amount0: tokenIsC0 ? tokenDelta : quoteDelta,
        amount1: tokenIsC0 ? quoteDelta : tokenDelta,
      });
      return {
        address: poolManager,
        topics: encoded.topics as Hex[],
        data: encoded.data,
        blockNumber: BigInt(row.blockNumber),
        logIndex: row.logIndex,
        transactionHash: row.txHash,
      };
    });
    const adapter = new UniswapV4Adapter({
      rpcUrl: "http://127.0.0.1:0",
      poolOrHook: tape.hooks,
      tokenAddress: tape.token,
      quoteAddress: tape.quote,
      chainId: 4663,
      poolManager,
      poolFee: tape.fee,
      tickSpacing: tape.tickSpacing,
      reader: {
        getBlockNumber: async () => 210n,
        getLogs: async () => logs,
        getLaunch: async () => null,
      },
    });
    const { trades } = await adapter.fetchTrades(199n);
    expect(trades.map((t) => t.kind)).toEqual(["buy", "sell"]);
    expect(trades[0].eventId).toBe(
      `${tape.events[0].txHash}:${tape.events[0].logIndex}`,
    );
    const runtime = new BellRuntime({
      ...config,
      gmeUsdPrice: tape.gmeUsdPrice,
      minBuyUsd: tape.minBuyUsd,
      ticketsPerUsd: tape.ticketsPerUsd,
    });
    for (const trade of trades) runtime.applyEvent(trade);
    const dave = getWallet(runtime.live, tape.events[0].sender);
    expect(dave.tickets).toBe(120_000);
    expect(dave.bellBalance).toBe(600);
  });
});
