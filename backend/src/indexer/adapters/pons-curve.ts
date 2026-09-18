import type { Hex } from "viem";

import {
  CURVE_TRADE_EVENTS,
  PONS_V2_FACTORY,
  isConfiguredAddress,
  pickCurveAddress,
} from "../abi.js";
import { rpcFromBlock } from "../cursor.js";
import { decodePonsCurveLogs, type DecodeAmounts } from "../decode.js";
import { createRpcReader, type ChainReader } from "../rpc.js";
import type { ChainTradeEvent, VenueAdapter } from "../types.js";

export interface PonsCurveAdapterOpts {
  rpcUrl: string;
  tokenAddress: string;
  curveAddress?: string;
  quoteAddress?: string;
  chainId: number;
  factoryAddress?: Hex;
  reader?: ChainReader;
  quoteDecimals?: number;
  tokenDecimals?: number;
}

/**
 * Pre-graduation PONS v2 BondingCurve indexer.
 * Source of truth: CurveBuy / CurveSell logs over RPC (not DexScreener).
 * Curve address: CREATE2 predicted CURVE_OR_POOL, or factory getLaunchedToken.
 * pairToken is GME; quoteIn/quoteOut map to gmeAmount.
 */
export class PonsCurveAdapter implements VenueAdapter {
  readonly name = "pons-curve";
  private warnedEmpty = false;
  private warnedPair = false;
  private readonly reader: ChainReader | null;
  private readonly amounts: DecodeAmounts;

  constructor(private readonly opts: PonsCurveAdapterOpts) {
    this.reader =
      opts.reader ??
      (opts.rpcUrl
        ? createRpcReader(opts.rpcUrl, opts.factoryAddress ?? PONS_V2_FACTORY)
        : null);
    this.amounts = {
      quoteDecimals: opts.quoteDecimals ?? 18,
      tokenDecimals: opts.tokenDecimals ?? 18,
    };
  }

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    if (!this.reader) {
      this.warnOnce(
        "FIXTURE_MODE=false: PONS curve adapter has no RPC reader. Set RPC_URL.",
      );
      return { trades: [], tipBlock: fromBlock };
    }

    const tip = await this.reader.getBlockNumber();
    const from = rpcFromBlock(fromBlock);
    if (from > tip) return { trades: [], tipBlock: tip };

    const curve = await this.resolveCurve();
    if (!curve) {
      this.warnOnce(
        "FIXTURE_MODE=false: no PONS curve address. Pre-stage CREATE2 CURVE_OR_POOL, or set TOKEN_ADDRESS so factory getLaunchedToken can resolve it. Indexer will not silently invent trades.",
      );
      return { trades: [], tipBlock: tip };
    }

    const trades = await fetchPonsCurveTrades({
      reader: this.reader,
      curve,
      from,
      tip,
      amounts: this.amounts,
    });

    if (trades.length === 0) {
      this.warnOnce(
        `FIXTURE_MODE=false: no CurveBuy/CurveSell logs in [${from}, ${tip}] on curve ${curve}. If the token already launched, START_BLOCK may be too late or the curve address is wrong. Missed buys are a start-block/decode issue, not a market pause.`,
      );
    }
    return { trades, tipBlock: tip };
  }

  private async resolveCurve(): Promise<Hex | null> {
    const token = isConfiguredAddress(this.opts.tokenAddress)
      ? this.opts.tokenAddress
      : null;
    const launch = token && this.reader ? await this.reader.getLaunch(token) : null;

    const expectedGme = isConfiguredAddress(this.opts.quoteAddress)
      ? this.opts.quoteAddress
      : null;
    if (
      launch?.pairToken &&
      expectedGme &&
      launch.pairToken.toLowerCase() !== expectedGme.toLowerCase()
    ) {
      this.warnPair(
        `PONS pairToken ${launch.pairToken} is not the configured GME quote ${expectedGme}. Curve quoteIn/quoteOut still map to gmeAmount.`,
      );
    }

    return pickCurveAddress({
      factoryCurve: launch?.curve,
      predictedCurve: this.opts.curveAddress,
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

/** Shared RPC log fetch used by PonsCurveAdapter and PonsLaunchAdapter. */
export async function fetchPonsCurveTrades(input: {
  reader: ChainReader;
  curve: Hex;
  from: bigint;
  tip: bigint;
  amounts?: DecodeAmounts;
}): Promise<ChainTradeEvent[]> {
  const logs = await input.reader.getLogs({
    address: input.curve,
    fromBlock: input.from,
    toBlock: input.tip,
    events: CURVE_TRADE_EVENTS,
  });
  return decodePonsCurveLogs(logs, input.amounts).filter(
    (row) => row.blockNumber >= input.from && row.blockNumber <= input.tip,
  );
}
