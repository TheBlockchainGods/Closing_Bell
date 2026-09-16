import type { Pool } from "pg";

import { config } from "../config.js";
import { FixtureAdapter } from "./adapters/fixture.js";
import { PonsCurveAdapter } from "./adapters/pons-curve.js";
import { UniswapV4Adapter } from "./adapters/uniswap-v4.js";
import type { ChainTradeEvent, VenueAdapter } from "./types.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";

export function buildAdapters(): VenueAdapter[] {
  if (config.fixtureMode) {
    return [new FixtureAdapter()];
  }

  const adapters: VenueAdapter[] = [];
  if (config.curveOrPool && config.tokenAddress && config.rpcUrl) {
    adapters.push(
      new PonsCurveAdapter({
        rpcUrl: config.rpcUrl,
        curveAddress: config.curveOrPool,
        tokenAddress: config.tokenAddress,
        chainId: config.chainId,
      }),
      new UniswapV4Adapter({
        rpcUrl: config.rpcUrl,
        poolOrHook: config.curveOrPool,
        tokenAddress: config.tokenAddress,
        chainId: config.chainId,
      }),
    );
  }
  return adapters;
}

export class IndexerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private onNewTrade:
    | ((event: ChainTradeEvent) => Promise<void> | void)
    | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly runtime: BellRuntime,
    private readonly adapters: VenueAdapter[],
    private readonly startBlock: bigint,
  ) {}

  setTradeHandler(
    handler: ((event: ChainTradeEvent) => Promise<void> | void) | null,
  ): void {
    this.onNewTrade = handler;
  }

  async start(): Promise<void> {
    await this.ensureCursors();
    await this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, config.indexerPollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async ensureCursors(): Promise<void> {
    for (const adapter of this.adapters) {
      await this.pool.query(
        `INSERT INTO indexer_cursor (adapter, last_block)
         VALUES ($1, $2)
         ON CONFLICT (adapter) DO NOTHING`,
        [adapter.name, this.startBlock.toString()],
      );
    }
  }

  private async getCursor(adapter: string): Promise<bigint> {
    const { rows } = await this.pool.query<{ last_block: string }>(
      `SELECT last_block::text AS last_block FROM indexer_cursor WHERE adapter = $1`,
      [adapter],
    );
    if (!rows[0]) return this.startBlock;
    return BigInt(rows[0].last_block);
  }

  private async setCursor(adapter: string, block: bigint): Promise<void> {
    await this.pool.query(
      `INSERT INTO indexer_cursor (adapter, last_block, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (adapter) DO UPDATE
         SET last_block = EXCLUDED.last_block,
             updated_at = NOW()`,
      [adapter, block.toString()],
    );
  }

  async pollOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const adapter of this.adapters) {
        const fromBlock = await this.getCursor(adapter.name);
        const { trades, tipBlock } = await adapter.fetchTrades(fromBlock);
        for (const trade of trades) {
          await this.ingest(trade);
        }
        if (tipBlock > fromBlock) {
          await this.setCursor(adapter.name, tipBlock);
        }
      }
      this.runtime.tick(new Date());
    } finally {
      this.running = false;
    }
  }

  /**
   * Idempotent ingest: event_id primary key prevents double-count on restart.
   */
  async ingest(event: ChainTradeEvent): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO ingested_events (
           event_id, adapter, tx_hash, log_index, block_number, kind,
           wallet, gme_amount, bell_amount, bell_balance_before, occurred_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [
          event.eventId,
          event.adapter,
          event.txHash,
          event.logIndex,
          event.blockNumber.toString(),
          event.kind,
          event.wallet.toLowerCase(),
          event.gmeAmount,
          event.bellAmount,
          event.bellBalanceBefore ?? null,
          event.occurredAt.toISOString(),
        ],
      );

      if (inserted.rowCount === 0) {
        await client.query("COMMIT");
        return false;
      }

      this.runtime.applyEvent(event);
      await client.query("COMMIT");
      if (this.onNewTrade) {
        await this.onNewTrade(event);
      }
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Rebuild live ticket book from persisted events (restart safety). */
  async replayAll(): Promise<void> {
    const { rows } = await this.pool.query<{
      event_id: string;
      adapter: string;
      tx_hash: string;
      log_index: number;
      block_number: string;
      kind: "buy" | "sell";
      wallet: string;
      gme_amount: string;
      bell_amount: string;
      bell_balance_before: string | null;
      occurred_at: Date;
    }>(
      `SELECT * FROM ingested_events
       ORDER BY block_number ASC, log_index ASC`,
    );

    this.runtime.live.clear();
    this.runtime.volumeGme = 0;
    this.runtime.volumeUsd = 0;
    this.runtime.snapshot = null;
    this.runtime.phase = "open";

    for (const row of rows) {
      this.runtime.applyEvent({
        eventId: row.event_id,
        adapter: row.adapter,
        txHash: row.tx_hash,
        logIndex: row.log_index,
        blockNumber: BigInt(row.block_number),
        kind: row.kind,
        wallet: row.wallet,
        gmeAmount: Number(row.gme_amount),
        bellAmount: Number(row.bell_amount),
        bellBalanceBefore:
          row.bell_balance_before === null
            ? undefined
            : Number(row.bell_balance_before),
        occurredAt: new Date(row.occurred_at),
      });
    }
  }
}
