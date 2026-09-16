import type { ChainTradeEvent, VenueAdapter } from "../types.js";

/**
 * Skeleton for PONS bonding-curve (pre-graduation) buys/sells.
 * Wire ABI + log decode when TOKEN_ADDRESS / CURVE_OR_POOL are set at launch.
 */
export class PonsCurveAdapter implements VenueAdapter {
  readonly name = "pons-curve";

  constructor(
    private readonly opts: {
      rpcUrl: string;
      curveAddress: string;
      tokenAddress: string;
      chainId: number;
    },
  ) {}

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    if (!this.opts.rpcUrl || !this.opts.curveAddress) {
      return { trades: [], tipBlock: fromBlock };
    }
    // TODO(launch): eth_getLogs / watchContractEvent for curve Buy/Sell.
    void fromBlock;
    return { trades: [], tipBlock: fromBlock };
  }
}
