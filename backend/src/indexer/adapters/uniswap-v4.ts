import type { ChainTradeEvent, VenueAdapter } from "../types.js";

/**
 * Skeleton for Uniswap v4 pool swaps after graduation.
 * Any venue that touches $BELL/GME should mint/burn tickets the same way.
 */
export class UniswapV4Adapter implements VenueAdapter {
  readonly name = "uniswap-v4";

  constructor(
    private readonly opts: {
      rpcUrl: string;
      poolOrHook: string;
      tokenAddress: string;
      chainId: number;
    },
  ) {}

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    if (!this.opts.rpcUrl || !this.opts.poolOrHook) {
      return { trades: [], tipBlock: fromBlock };
    }
    // TODO(launch): decode Swap logs; classify buy vs sell vs GME.
    void fromBlock;
    return { trades: [], tipBlock: fromBlock };
  }
}
