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

/** Sort by block/logIndex and drop duplicate eventIds (graduation overlap). */
export function mergeTradeEvents(
  ...groups: ChainTradeEvent[][]
): ChainTradeEvent[] {
  const seen = new Set<string>();
  const out: ChainTradeEvent[] = [];
  const all = groups.flat().sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });
  for (const row of all) {
    if (seen.has(row.eventId)) continue;
    seen.add(row.eventId);
    out.push(row);
  }
  return out;
}
