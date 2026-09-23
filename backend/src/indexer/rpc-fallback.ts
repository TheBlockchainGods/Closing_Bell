/**
 * Indexer logs use public Robinhood Chain first.
 * Alchemy Free cannot serve eth_getLogs wider than 10 blocks on this chain.
 * Draw seed / pot / payouts keep RPC_URL (chain/blockhash.ts, pot/chain.ts).
 */
import { custom, fallback, type Transport } from "viem";

export const PUBLIC_RH_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";

/** Refuse START_BLOCK=0 backfill at or above this chain tip. */
export const GENESIS_SCAN_TIP_THRESHOLD = 1_000_000n;

export type RpcLane = "primary" | "fallback";

export function rpcHost(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).host;
  } catch {
    return "invalid-rpc-url";
  }
}

function normalizeRpcUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Tickets do not depend on Alchemy Free getLogs.
 * `fallbackUrl` undefined → public RH is the log primary; RPC_URL is optional backup.
 * `fallbackUrl` null or "" → pin to rpcUrl only (tests).
 */
export function resolveIndexerRpcUrls(input: {
  rpcUrl: string;
  fallbackUrl?: string | null;
}): { primary: string; fallback: string | null } {
  const configured = input.rpcUrl.trim();
  if (!configured) return { primary: "", fallback: null };
  if (input.fallbackUrl === null || input.fallbackUrl === "") {
    return { primary: configured, fallback: null };
  }
  const logPrimary =
    input.fallbackUrl === undefined
      ? PUBLIC_RH_RPC_URL
      : input.fallbackUrl.trim() || PUBLIC_RH_RPC_URL;
  if (normalizeRpcUrl(configured) === normalizeRpcUrl(logPrimary)) {
    return { primary: configured, fallback: null };
  }
  return { primary: logPrimary, fallback: configured };
}

export function genesisScanDecision(input: {
  tokenAddress: string;
  startBlock: number;
  tipBlock: bigint | null;
}): { refuse: boolean; message: string | null } {
  const tokenSet = input.tokenAddress.trim() !== "";
  const startMissing =
    !Number.isFinite(input.startBlock) || input.startBlock <= 0;
  if (!tokenSet || !startMissing) {
    return { refuse: false, message: null };
  }

  const tipLabel =
    input.tipBlock === null ? "unknown" : input.tipBlock.toString();
  const tipHuge =
    input.tipBlock !== null && input.tipBlock >= GENESIS_SCAN_TIP_THRESHOLD;
  const tipUnknown = input.tipBlock === null;
  if (!tipHuge && !tipUnknown) {
    return { refuse: false, message: null };
  }

  return {
    refuse: true,
    message: `TOKEN_ADDRESS is set but START_BLOCK is ${input.startBlock || "missing/0"} while chain tip is ${tipLabel} (multi-million). Refusing genesis scan. Set START_BLOCK to the PONS create tx block or earlier.`,
  };
}

export class RpcFailoverMonitor {
  private active: RpcLane = "primary";

  constructor(
    private readonly hosts: { primary: string; fallback: string },
    private readonly log: (level: "error" | "info", message: string) => void = (
      level,
      message,
    ) => {
      if (level === "error") console.error(message);
      else console.log(message);
    },
  ) {}

  noteSuccess(lane: RpcLane): void {
    if (lane === "fallback" && this.active !== "fallback") {
      this.active = "fallback";
      this.log(
        "error",
        `Indexer RPC primary (${this.hosts.primary}) failed; using fallback (${this.hosts.fallback}).`,
      );
      return;
    }
    if (lane === "primary" && this.active !== "primary") {
      this.active = "primary";
      this.log(
        "info",
        `Indexer RPC primary (${this.hosts.primary}) recovered; leaving fallback.`,
      );
    }
  }

  get activeLane(): RpcLane {
    return this.active;
  }
}

export function isLogRangeError(err: unknown): boolean {
  const cause =
    err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const message = err instanceof Error ? err.message : String(err);
  return /block range|10 block/i.test(`${message} ${cause}`);
}

export function isFailoverHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isFailoverRpcBody(text: string): boolean {
  try {
    const json = JSON.parse(text) as {
      error?: { code?: number; message?: string };
    };
    const err = json?.error;
    if (!err) return false;
    if (err.code === 429 || err.code === -32005) return true;
    const message = String(err.message ?? "");
    return /rate.?limit|too many requests|capacity|block range|free tier/i.test(
      message,
    );
  } catch {
    return false;
  }
}

async function jsonRpcRequest(
  url: string,
  method: string,
  params: unknown,
  fetchImpl: typeof fetch,
  id: number,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? [],
    }),
  });
  const text = await res.text();
  if (isFailoverHttpStatus(res.status) || isFailoverRpcBody(text)) {
    const range = /block range|10 block/i.test(text);
    throw new Error(
      range
        ? `indexer RPC HTTP ${res.status} block range`
        : `indexer RPC HTTP ${res.status} failover`,
    );
  }
  if (!res.ok) {
    throw new Error(`indexer RPC HTTP ${res.status}`);
  }
  let json: { result?: unknown; error?: { code?: number; message?: string } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("indexer RPC returned non-JSON");
  }
  if (json.error) {
    throw new Error(json.error.message ?? `RPC error ${json.error.code}`);
  }
  return json.result;
}

export function createIndexerTransport(input: {
  primary: string;
  fallback: string | null;
  fetch?: typeof fetch;
  monitor?: RpcFailoverMonitor;
}): Transport {
  const fetchImpl = input.fetch ?? globalThis.fetch.bind(globalThis);
  const monitor =
    input.monitor ??
    (input.fallback
      ? new RpcFailoverMonitor({
          primary: rpcHost(input.primary),
          fallback: rpcHost(input.fallback),
        })
      : undefined);

  let nextId = 1;
  const laneTransport = (url: string, lane: RpcLane) =>
    custom(
      {
        async request({ method, params }) {
          const result = await jsonRpcRequest(
            url,
            method,
            params,
            fetchImpl,
            nextId++,
          );
          monitor?.noteSuccess(lane);
          return result;
        },
      },
      { key: `indexer-${lane}`, name: `indexer ${lane}`, retryCount: 0 },
    );

  if (!input.fallback) {
    return laneTransport(input.primary, "primary");
  }
  return fallback(
    [laneTransport(input.primary, "primary"), laneTransport(input.fallback, "fallback")],
    { rank: false, retryCount: 0 },
  );
}
