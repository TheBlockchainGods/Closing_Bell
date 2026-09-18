import type { Hex } from "viem";

import {
  LaunchPhase,
  PONS_V2_HOOK,
  isConfiguredAddress,
  launchPhaseName,
  pickCurveAddress,
  PONS_V2_FACTORY,
  UNISWAP_V4_POOL_MANAGER,
} from "../abi.js";
import { rpcFromBlock } from "../cursor.js";
import { createRpcReader, type ChainReader, type LaunchRecord } from "../rpc.js";
import { mergeTradeEvents, type ChainTradeEvent, type VenueAdapter } from "../types.js";
import { fetchPonsCurveTrades } from "./pons-curve.js";
import { fetchUv4PoolSwaps } from "./uniswap-v4.js";

export interface PonsLaunchAdapterOpts {
  rpcUrl: string;
  tokenAddress: Hex;
  curveAddress: Hex;
  quoteAddress: Hex;
  chainId: number;
  factoryAddress?: Hex;
  poolManager?: Hex;
  hookAddress?: Hex;
  quoteDecimals?: number;
  tokenDecimals?: number;
  reader?: ChainReader;
}

/**
 * Phase-aware live indexer. Curve while NotGraduated; UV4 Swap after
 * PoolCreated. CREATE2: predicted curve can be watched before factory exists.
 * Does not depend on DexScreener / GeckoTerminal.
 */
export class PonsLaunchAdapter implements VenueAdapter {
  readonly name = "pons-launch";
  private warnedEmpty = false;
  private warnedPair = false;
  private lastPhase: number | null = null;
  private readonly reader: ChainReader;
  private readonly amounts: { quoteDecimals: number; tokenDecimals: number };
  private readonly poolManager: Hex;

  constructor(private readonly opts: PonsLaunchAdapterOpts) {
    this.reader =
      opts.reader ??
      createRpcReader(opts.rpcUrl, opts.factoryAddress ?? PONS_V2_FACTORY);
    this.amounts = {
      quoteDecimals: opts.quoteDecimals ?? 18,
      tokenDecimals: opts.tokenDecimals ?? 18,
    };
    this.poolManager = opts.poolManager ?? UNISWAP_V4_POOL_MANAGER;
  }

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    const tip = await this.reader.getBlockNumber();
    const from = rpcFromBlock(fromBlock);
    if (from > tip) {
      return { trades: [], tipBlock: tip };
    }

    const launch = await this.resolveLaunch();
    const phase = launch?.phase ?? LaunchPhase.NotGraduated;
    if (this.lastPhase !== null && this.lastPhase !== phase) {
      console.log(
        `PONS launch phase ${launchPhaseName(this.lastPhase)} → ${launchPhaseName(phase)}`,
      );
      this.warnedEmpty = false;
    }
    this.lastPhase = phase;

    if (phase === LaunchPhase.Rescued) {
      this.warnOnce(
        "PONS launch phase is Rescued. Indexer will not mint tickets from this venue.",
      );
      return { trades: [], tipBlock: tip };
    }

    const curveTrades = await this.fetchCurveTrades(from, tip, launch);
    let trades: ChainTradeEvent[] = curveTrades;
    if (phase === LaunchPhase.PoolCreated) {
      const swaps = await this.fetchPoolSwaps(from, tip, launch);
      trades = mergeTradeEvents(curveTrades, swaps);
    }

    if (trades.length === 0) {
      if (phase === LaunchPhase.Swept) {
        this.warnOnce(
          "PONS launch is Swept (curve closed, pool not yet created). No new trades this phase. Tickets wait for PoolCreated swaps. This is not a silent skip.",
        );
      } else {
        this.warnOnce(
          `FIXTURE_MODE=false: no ${phase === LaunchPhase.PoolCreated ? "UV4 Swap" : "CurveBuy/CurveSell"} logs in [${from}, ${tip}]. If the token already launched, START_BLOCK may be too late or the curve/pool address is wrong. Missed buys are a start-block/decode issue, not a market pause.`,
        );
      }
    }
    return { trades, tipBlock: tip };
  }

  private async resolveLaunch(): Promise<LaunchRecord | null> {
    const fromFactory = await this.reader.getLaunch(this.opts.tokenAddress);
    if (fromFactory) {
      if (
        isConfiguredAddress(this.opts.quoteAddress) &&
        fromFactory.pairToken.toLowerCase() !== this.opts.quoteAddress.toLowerCase()
      ) {
        this.warnPair(
          `PONS pairToken ${fromFactory.pairToken} is not the configured GME quote ${this.opts.quoteAddress}. Curve quoteIn/quoteOut still map to gmeAmount.`,
        );
      }
      return fromFactory;
    }
    const predicted = pickCurveAddress({
      predictedCurve: this.opts.curveAddress,
    });
    if (predicted) {
      return {
        token: this.opts.tokenAddress,
        curve: predicted,
        pairToken: this.opts.quoteAddress,
        phase: LaunchPhase.NotGraduated,
        exists: false,
        poolFee: 0,
        tickSpacing: 0,
      };
    }
    return null;
  }

  private async fetchCurveTrades(
    from: bigint,
    tip: bigint,
    launch: LaunchRecord | null,
  ): Promise<ChainTradeEvent[]> {
    const curve = pickCurveAddress({
      factoryCurve: launch?.curve,
      predictedCurve: this.opts.curveAddress,
    });
    if (!curve) return [];
    return fetchPonsCurveTrades({
      reader: this.reader,
      curve,
      from,
      tip,
      amounts: this.amounts,
    });
  }

  private async fetchPoolSwaps(
    from: bigint,
    tip: bigint,
    launch: LaunchRecord | null,
  ): Promise<ChainTradeEvent[]> {
    const token = (launch?.token ?? this.opts.tokenAddress).toLowerCase();
    const quote = (launch?.pairToken ?? this.opts.quoteAddress).toLowerCase();
    if (!token || !quote || quote.startsWith("0x0000000000000000000000000000000000000000")) {
      return [];
    }
    return fetchUv4PoolSwaps({
      reader: this.reader,
      from,
      tip,
      token,
      quote,
      hook: this.opts.hookAddress ?? PONS_V2_HOOK,
      poolManager: this.poolManager,
      poolFee: launch?.poolFee ?? 0,
      tickSpacing: launch?.tickSpacing ?? 60,
      amounts: this.amounts,
    });
  }

  private warnOnce(message: string): void {
    if (this.warnedEmpty) return;
    this.warnedEmpty = true;
    console.error(message);
  }

  private warnPair(message: string): void {
    if (this.warnedPair) return;
    this.warnedPair = true;
    console.error(message);
  }
}
