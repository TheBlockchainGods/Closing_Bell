export type TradeKind = "buy" | "sell";

export interface ChainTradeEvent {
  /** Stable idempotency key: `${txHash}:${logIndex}` */
  eventId: string;
  adapter: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  kind: TradeKind;
  wallet: string;
  /** GME amount spent (buy) or received (sell). */
  gmeAmount: number;
  /** $BELL received (buy) or sold (sell). */
  bellAmount: number;
  /** Required for accurate sell burns when known. */
  bellBalanceBefore?: number;
  occurredAt: Date;
}

export interface VenueAdapter {
  readonly name: string;
  /**
   * Fetch new trades after `fromBlock` (exclusive of already-processed cursor).
   * Implementations must be restart-safe; the ingest layer dedupes by eventId.
   */
  fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }>;
}
