import {
  createPublicClient,
  http,
  type Hex,
  type PublicClient,
} from "viem";

import {
  GET_LAUNCHED_TOKEN_ABI,
  LaunchPhase,
  PONS_V2_FACTORY,
} from "./abi.js";

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

const LOG_SPAN = 2_000n;

export function createRpcReader(
  rpcUrl: string,
  factoryAddress: Hex = PONS_V2_FACTORY,
): ChainReader {
  const client = createPublicClient({
    transport: http(rpcUrl),
  }) as PublicClient;

  return {
    async getBlockNumber() {
      return client.getBlockNumber();
    },
    async getLogs(query) {
      const out: RpcLog[] = [];
      let from = query.fromBlock;
      while (from <= query.toBlock) {
        const to =
          from + LOG_SPAN - 1n > query.toBlock
            ? query.toBlock
            : from + LOG_SPAN - 1n;
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
