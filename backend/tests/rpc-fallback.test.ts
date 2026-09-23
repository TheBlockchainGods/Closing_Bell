import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

import { CURVE_TRADE_EVENTS } from "../src/indexer/abi.js";
import { createRpcReader } from "../src/indexer/rpc.js";
import {
  GENESIS_SCAN_TIP_THRESHOLD,
  PUBLIC_RH_RPC_URL,
  RpcFailoverMonitor,
  genesisScanDecision,
  isFailoverHttpStatus,
  isFailoverRpcBody,
  isLogRangeError,
  resolveIndexerRpcUrls,
  rpcHost,
} from "../src/indexer/rpc-fallback.js";

const PRIMARY = "https://robinhood-mainnet.g.alchemy.com/v2/test-key";
const FALLBACK = PUBLIC_RH_RPC_URL;
const CURVE = "0x1111111111111111111111111111111111111111" as Hex;

function rpcUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function jsonRpc(result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jsonRpcError(code: number, message: string, status = 200): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code, message } }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("resolveIndexerRpcUrls", () => {
  it("uses public Robinhood Chain as log primary, Alchemy as optional backup", () => {
    expect(resolveIndexerRpcUrls({ rpcUrl: PRIMARY })).toEqual({
      primary: PUBLIC_RH_RPC_URL,
      fallback: PRIMARY,
    });
  });

  it("uses RPC_FALLBACK_URL as the log primary", () => {
    expect(
      resolveIndexerRpcUrls({
        rpcUrl: PRIMARY,
        fallbackUrl: "https://example-rpc.test",
      }),
    ).toEqual({
      primary: "https://example-rpc.test",
      fallback: PRIMARY,
    });
  });

  it("disables fallback when override is empty or the same URL", () => {
    expect(
      resolveIndexerRpcUrls({ rpcUrl: PRIMARY, fallbackUrl: null }),
    ).toEqual({ primary: PRIMARY, fallback: null });
    expect(
      resolveIndexerRpcUrls({ rpcUrl: PRIMARY, fallbackUrl: "" }),
    ).toEqual({ primary: PRIMARY, fallback: null });
    expect(
      resolveIndexerRpcUrls({
        rpcUrl: `${FALLBACK}/`,
        fallbackUrl: FALLBACK,
      }),
    ).toEqual({ primary: `${FALLBACK}/`, fallback: null });
  });

  it("exposes hosts without the Alchemy path", () => {
    expect(rpcHost(PRIMARY)).toBe("robinhood-mainnet.g.alchemy.com");
    expect(rpcHost(FALLBACK)).toBe("rpc.mainnet.chain.robinhood.com");
  });
});

describe("genesisScanDecision", () => {
  const token = "0x2222222222222222222222222222222222222222";

  it("refuses START_BLOCK 0 when TOKEN is set and tip is multi-million", () => {
    const row = genesisScanDecision({
      tokenAddress: token,
      startBlock: 0,
      tipBlock: 66_000_000n,
    });
    expect(row.refuse).toBe(true);
    expect(row.message).toContain("Refusing genesis scan");
  });

  it("refuses when tip cannot be read", () => {
    expect(
      genesisScanDecision({
        tokenAddress: token,
        startBlock: 0,
        tipBlock: null,
      }).refuse,
    ).toBe(true);
  });

  it("allows START_BLOCK 0 below the multi-million tip threshold", () => {
    expect(
      genesisScanDecision({
        tokenAddress: token,
        startBlock: 0,
        tipBlock: GENESIS_SCAN_TIP_THRESHOLD - 1n,
      }).refuse,
    ).toBe(false);
  });

  it("allows when TOKEN is empty or START_BLOCK is the create block", () => {
    expect(
      genesisScanDecision({
        tokenAddress: "",
        startBlock: 0,
        tipBlock: 66_000_000n,
      }).refuse,
    ).toBe(false);
    expect(
      genesisScanDecision({
        tokenAddress: token,
        startBlock: 12_345_678,
        tipBlock: 66_000_000n,
      }).refuse,
    ).toBe(false);
  });
});

describe("RpcFailoverMonitor", () => {
  it("logs once on failover and once on recovery", () => {
    const lines: string[] = [];
    const monitor = new RpcFailoverMonitor(
      { primary: "alchemy.example", fallback: "rpc.mainnet.chain.robinhood.com" },
      (_level, message) => lines.push(message),
    );
    monitor.noteSuccess("fallback");
    monitor.noteSuccess("fallback");
    monitor.noteSuccess("fallback");
    monitor.noteSuccess("primary");
    monitor.noteSuccess("primary");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("using fallback");
    expect(lines[1]).toContain("recovered");
  });
});

describe("failover heuristics", () => {
  it("treats 429/5xx and Alchemy rate-limit JSON as failover", () => {
    expect(isFailoverHttpStatus(429)).toBe(true);
    expect(isFailoverHttpStatus(503)).toBe(true);
    expect(isFailoverHttpStatus(200)).toBe(false);
    expect(isFailoverRpcBody('{"error":{"code":429,"message":"Too many"}}')).toBe(
      true,
    );
    expect(isFailoverRpcBody('{"error":{"code":-32005,"message":"rate limit"}}')).toBe(
      true,
    );
    expect(
      isFailoverRpcBody(
        '{"error":{"code":-32600,"message":"Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range."}}',
      ),
    ).toBe(true);
    expect(isFailoverRpcBody('{"result":"0x1"}')).toBe(false);
    expect(
      isLogRangeError(new Error("indexer RPC HTTP 400 block range")),
    ).toBe(true);
    expect(isLogRangeError(new Error("indexer RPC HTTP 429 failover"))).toBe(
      false,
    );
  });
});

describe("createRpcReader failover", () => {
  it("uses public RH first, then Alchemy if public rate-limits", async () => {
    const hits: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = rpcUrl(input);
      hits.push(url);
      if (url.includes("rpc.mainnet.chain.robinhood.com")) {
        return new Response("rate limited", { status: 429 });
      }
      return jsonRpc("0x10");
    };
    const reader = createRpcReader(PRIMARY, undefined, {
      fallbackUrl: FALLBACK,
      fetch: fetchImpl,
    });
    await expect(reader.getBlockNumber()).resolves.toBe(16n);
    expect(hits.some((row) => row.includes("rpc.mainnet.chain.robinhood.com"))).toBe(
      true,
    );
    expect(hits.some((row) => row.includes("alchemy"))).toBe(true);
  });

  it("serves getLogs from public RH without calling Alchemy", async () => {
    const hits: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = rpcUrl(input);
      hits.push(url);
      const body = String(init?.body ?? "");
      if (url.includes("alchemy")) {
        return jsonRpcError(-32600, "Free tier 10 block range");
      }
      if (body.includes("eth_getLogs")) return jsonRpc([]);
      if (body.includes("eth_blockNumber")) return jsonRpc("0x64");
      return jsonRpc("0x1");
    };
    const reader = createRpcReader(PRIMARY, undefined, {
      fallbackUrl: FALLBACK,
      fetch: fetchImpl,
    });
    const logs = await reader.getLogs({
      address: CURVE,
      fromBlock: 1n,
      toBlock: 1n,
      events: CURVE_TRADE_EVENTS,
    });
    expect(logs).toEqual([]);
    expect(hits.every((row) => !row.includes("alchemy"))).toBe(true);
  });

  it("bisects a block-range rejection instead of throwing", async () => {
    const spans: bigint[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: Array<{ fromBlock?: string; toBlock?: string }>;
      };
      if (body.method === "eth_getLogs") {
        const from = BigInt(body.params?.[0]?.fromBlock ?? "0x0");
        const to = BigInt(body.params?.[0]?.toBlock ?? "0x0");
        const span = to - from + 1n;
        spans.push(span);
        if (span > 20n) {
          return jsonRpcError(
            -32602,
            "eth_getLogs block range is too large",
            400,
          );
        }
      }
      return jsonRpc([]);
    };
    const reader = createRpcReader(PRIMARY, undefined, {
      fallbackUrl: FALLBACK,
      fetch: fetchImpl,
    });
    const logs = await reader.getLogs({
      address: CURVE,
      fromBlock: 1n,
      toBlock: 80n,
      events: CURVE_TRADE_EVENTS,
    });
    expect(logs).toEqual([]);
    expect(spans.some((span) => span > 20n)).toBe(true);
    expect(spans.some((span) => span <= 20n)).toBe(true);
  });

  it("does not spam failover logs across polls, then logs recovery once", async () => {
    const lines: string[] = [];
    const monitor = new RpcFailoverMonitor(
      {
        primary: rpcHost(FALLBACK),
        fallback: rpcHost(PRIMARY),
      },
      (_level, message) => lines.push(message),
    );
    let publicDown = true;
    const fetchImpl: typeof fetch = async (input) => {
      const url = rpcUrl(input);
      if (url.includes("rpc.mainnet.chain.robinhood.com") && publicDown) {
        return new Response("nope", { status: 503 });
      }
      return jsonRpc("0x20");
    };
    const reader = createRpcReader(PRIMARY, undefined, {
      fallbackUrl: FALLBACK,
      fetch: fetchImpl,
      monitor,
    });
    await reader.getBlockNumber();
    await reader.getBlockNumber();
    publicDown = false;
    await reader.getBlockNumber();
    await reader.getBlockNumber();
    expect(lines).toEqual([
      `Indexer RPC primary (${rpcHost(FALLBACK)}) failed; using fallback (${rpcHost(PRIMARY)}).`,
      `Indexer RPC primary (${rpcHost(FALLBACK)}) recovered; leaving fallback.`,
    ]);
  });
});
