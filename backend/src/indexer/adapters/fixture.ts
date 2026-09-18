import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ChainTradeEvent, VenueAdapter } from "../types.js";

export interface FixtureRow {
  adapter?: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  kind: "buy" | "sell";
  wallet: string;
  gmeAmount: number;
  bellAmount: number;
  bellBalanceBefore?: number;
  occurredAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadFixtureRows(): FixtureRow[] {
  const path = resolve(__dirname, "../../../fixtures/swaps.json");
  return JSON.parse(readFileSync(path, "utf8")) as FixtureRow[];
}

export function fixtureRowToEvent(row: FixtureRow): ChainTradeEvent {
  return {
    eventId: `${row.txHash.toLowerCase()}:${row.logIndex}`,
    adapter: row.adapter ?? "fixture",
    txHash: row.txHash.toLowerCase(),
    logIndex: row.logIndex,
    blockNumber: BigInt(row.blockNumber),
    kind: row.kind,
    wallet: row.wallet.toLowerCase(),
    gmeAmount: row.gmeAmount,
    bellAmount: row.bellAmount,
    bellBalanceBefore: row.bellBalanceBefore,
    occurredAt: new Date(row.occurredAt),
  };
}

/**
 * Replays mock swaps from `fixtures/swaps.json` when FIXTURE_MODE=true.
 * Cursor semantics match live adapters: only events with block > fromBlock.
 */
export class FixtureAdapter implements VenueAdapter {
  readonly name = "fixture";
  private readonly events: ChainTradeEvent[];

  constructor(rows: FixtureRow[] = loadFixtureRows()) {
    this.events = rows.map(fixtureRowToEvent).sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });
  }

  async fetchTrades(fromBlock: bigint): Promise<{
    trades: ChainTradeEvent[];
    tipBlock: bigint;
  }> {
    const trades = this.events.filter((e) => e.blockNumber > fromBlock);
    const tipBlock =
      this.events.length === 0
        ? fromBlock
        : this.events[this.events.length - 1].blockNumber;
    return { trades, tipBlock };
  }
}
