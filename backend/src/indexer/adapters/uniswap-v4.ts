import type { Hex } from "viem";

import { PONS_V2_HOOK, UV4_SWAP_EVENT, UNISWAP_V4_POOL_MANAGER } from "../abi.js";
import { rpcFromBlock } from "../cursor.js";
import {
  computePoolId,
  decodeUniswapV4SwapLogs,
  tokenIsCurrency0,
  type DecodeAmounts,
} from "../decode.js";
import { createRpcReader, type ChainReader } from "../rpc.js";
import type { ChainTradeEvent, VenueAdapter } from "../types.js";

export interface UniswapV4AdapterOpts {
  rpcUrl: string;
  tokenAddress: string;
  chainId: number;
  quoteAddress: string;
  poolOrHook?: string;
  hookAddress?: Hex;
  poolManager?: Hex;
  poolFee?: number;
  tickSpacing?: number;
  reader?: ChainReader;
  quoteDecimals?: number;
  tokenDecimals?: number;
}

/**
 * Post-graduation Uniswap v4 PoolManager Swap logs for a PONS GME pool.
 * PoolId = keccak256(abi.encode(PoolKey)); hook is the PONS meme hook.
 * Prefer PonsLaunchAdapter so phase (curve → swept → pool) stays consistent.
 */
export class UniswapV4Adapter implements VenueAdapter {
  readonly name = "uniswap-v4";
  private warnedEmpty = false;
  private readonly reader: ChainReader | null;
  private readonly amounts: DecodeAmounts;

  constructor(private readonly opts: UniswapV4AdapterOpts) {
    this.reader =
      opts.reader ?? (opts.rpcUrl ? createRpcReader(opts.rpcUrl) : null);
    this.amounts = {
      quoteDecimals: opts.quoteDecimals ?? 18,
      tokenDecimals: opts.tokenDecimals ?? 18,
    };
  }

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    if (!this.reader || !this.opts.tokenAddress || !this.opts.quoteAddress) {
      this.warnOnce(
        "FIXTURE_MODE=false: UV4 adapter missing RPC reader, TOKEN_ADDRESS, or GME quote. Indexer will not invent swaps.",
      );
      return { trades: [], tipBlock: fromBlock };
    }
    const tip = await this.reader.getBlockNumber();
    const from = rpcFromBlock(fromBlock);
    if (from > tip) return { trades: [], tipBlock: tip };

    const trades = await fetchUv4PoolSwaps({
      reader: this.reader,
      from,
      tip,
      token: this.opts.tokenAddress,
      quote: this.opts.quoteAddress,
      hook: this.opts.hookAddress ?? this.opts.poolOrHook ?? PONS_V2_HOOK,
      poolManager: this.opts.poolManager ?? UNISWAP_V4_POOL_MANAGER,
      poolFee: this.opts.poolFee ?? 0,
      tickSpacing: this.opts.tickSpacing ?? 60,
      amounts: this.amounts,
    });

    if (trades.length === 0) {
      this.warnOnce(
        `FIXTURE_MODE=false: no UV4 Swap logs in [${from}, ${tip}] for this pool. If the token already graduated, START_BLOCK or PoolKey (fee/tick/hook) may be wrong. Missed buys are a start-block/decode issue, not a market pause.`,
      );
    }
    return { trades, tipBlock: tip };
  }

  private warnOnce(message: string): void {
    if (this.warnedEmpty) return;
    this.warnedEmpty = true;
    console.error(message);
  }
}

/** Shared PoolManager Swap fetch used by UniswapV4Adapter and PonsLaunchAdapter. */
export async function fetchUv4PoolSwaps(input: {
  reader: ChainReader;
  from: bigint;
  tip: bigint;
  token: string;
  quote: string;
  hook: string;
  poolManager: Hex;
  poolFee: number;
  tickSpacing: number;
  amounts?: DecodeAmounts;
}): Promise<ChainTradeEvent[]> {
  const token = input.token.toLowerCase();
  const quote = input.quote.toLowerCase();
  const poolId = computePoolId({
    token,
    quote,
    fee: input.poolFee,
    tickSpacing: input.tickSpacing,
    hooks: input.hook,
  });
  const logs = await input.reader.getLogs({
    address: input.poolManager,
    fromBlock: input.from,
    toBlock: input.tip,
    events: [UV4_SWAP_EVENT],
    args: { id: poolId },
  });
  return decodeUniswapV4SwapLogs(logs, {
    tokenAddress: token,
    quoteAddress: quote,
    tokenIsCurrency0: tokenIsCurrency0(token, quote),
    amounts: input.amounts,
  }).filter((row) => row.blockNumber >= input.from && row.blockNumber <= input.tip);
}
