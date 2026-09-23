import { createPublicClient, type Hex, type PublicClient } from "viem";

import { config } from "../config.js";
import {
  GET_LAUNCHED_TOKEN_ABI,
  LaunchPhase,
  PONS_V2_FACTORY,
} from "./abi.js";
import {
  createIndexerTransport,
  isLogRangeError,
  resolveIndexerRpcUrls,
  type RpcFailoverMonitor,
} from "./rpc-fallback.js";

export interface RpcLog {
  address: Hex;
  topics: Hex[];
  data: Hex;
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: Hex | null;
}

export interface LaunchRecord {
  token: Hex;
  curve: Hex;
  pairToken: Hex;
  phase: LaunchPhase;
  exists: boolean;
  poolFee: number;
  tickSpacing: number;
}

export interface LogQuery {
  address: Hex;
  fromBlock: bigint;
  toBlock: bigint;
  events: readonly unknown[];
  args?: Record<string, unknown>;
}

export interface ChainReader {
  getBlockNumber(): Promise<bigint>;
  getLogs(query: LogQuery): Promise<RpcLog[]>;
  getLaunch(token: Hex): Promise<LaunchRecord | null>;
}

/** Public RH rejects wide eth_getLogs with HTTP 400. Start small and bisect. */
const LOG_SPAN = 100n;

export interface RpcReaderOpts {
  /** Override `RPC_FALLBACK_URL`. `null` disables fallback (tests). */
  fallbackUrl?: string | null;
  fetch?: typeof fetch;
  monitor?: RpcFailoverMonitor;
}

export function createRpcReader(
  rpcUrl: string,
  factoryAddress: Hex = PONS_V2_FACTORY,
  opts?: RpcReaderOpts,
): ChainReader {
  const urls = resolveIndexerRpcUrls({
    rpcUrl,
    fallbackUrl:
      opts && "fallbackUrl" in opts ? opts.fallbackUrl : config.rpcFallbackUrl,
  });
  const client = createPublicClient({
    // Ticket polls must see the next block. Default cacheTime (4s) also hid Alchemy recovery.
    cacheTime: 0,
    transport: createIndexerTransport({
      primary: urls.primary,
      fallback: urls.fallback,
      fetch: opts?.fetch,
      monitor: opts?.monitor,
    }),
  }) as PublicClient;

  return {
    async getBlockNumber() {
      return client.getBlockNumber();
    },
    async getLogs(query) {
      const out: RpcLog[] = [];

      const pull = async (from: bigint, to: bigint): Promise<void> => {
        try {
          const chunk = (await client.getLogs({
            address: query.address,
            fromBlock: from,
            toBlock: to,
            events: query.events as never,
            ...(query.args ? { args: query.args as never } : {}),
          })) as Array<{
            address: Hex;
            topics: readonly Hex[];
            data: Hex;
            blockNumber: bigint | null;
            logIndex: number | null;
            transactionHash: Hex | null;
          }>;
          for (const log of chunk) {
            out.push({
              address: log.address,
              topics: [...log.topics] as Hex[],
              data: log.data,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              transactionHash: log.transactionHash,
            });
          }
        } catch (err) {
          const span = to - from + 1n;
          if (!isLogRangeError(err) || span <= 1n) throw err;
          const mid = from + span / 2n - 1n;
          await pull(from, mid);
          await pull(mid + 1n, to);
        }
      };

      let from = query.fromBlock;
      while (from <= query.toBlock) {
        const to =
          from + LOG_SPAN - 1n > query.toBlock
            ? query.toBlock
            : from + LOG_SPAN - 1n;
        await pull(from, to);
        from = to + 1n;
      }
      return out;
    },
    async getLaunch(token) {
      try {
        const row = await client.readContract({
          address: factoryAddress,
          abi: GET_LAUNCHED_TOKEN_ABI,
          functionName: "getLaunchedToken",
          args: [token],
        });
        const rec = row as {
          token: Hex;
          curve: Hex;
          pairToken: Hex;
          phase: number;
          exists: boolean;
          poolFee: number;
          tickSpacing: number;
        };
        if (!rec.exists) return null;
        return {
          token: rec.token,
          curve: rec.curve,
          pairToken: rec.pairToken,
          phase: rec.phase as LaunchPhase,
          exists: true,
          poolFee: rec.poolFee,
          tickSpacing: rec.tickSpacing,
        };
      } catch {
        return null;
      }
    },
  };
}
