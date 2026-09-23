import type { Pool } from "pg";

import { config } from "../config.js";
import { FixtureAdapter } from "./adapters/fixture.js";
import { PonsLaunchAdapter } from "./adapters/pons-launch.js";
import { bootCursor, cursorSeed } from "./cursor.js";
import { genesisScanDecision } from "./rpc-fallback.js";
import { createRpcReader } from "./rpc.js";
import type { ChainTradeEvent, VenueAdapter } from "./types.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import type { Hex } from "viem";
import { PONS_V2_FACTORY, PONS_V2_HOOK, UNISWAP_V4_POOL_MANAGER } from "./abi.js";
import type { EoaGate } from "../chain/eoa-gate.js";

export function buildAdapters(): VenueAdapter[] {
  if (config.fixtureMode) {
    return [new FixtureAdapter()];
  }

  if (!config.tokenAddress || !config.rpcUrl) {
    console.error(
      "FIXTURE_MODE=false but TOKEN_ADDRESS or RPC_URL is empty. Indexer will idle. Pre-stage CREATE2 addresses before launch, or set them immediately after and backfill from START_BLOCK.",
    );
    return [];
  }

  return [
    new PonsLaunchAdapter({
      rpcUrl: config.rpcUrl,
      tokenAddress: config.tokenAddress as Hex,
      curveAddress: (config.curveOrPool || "0x0000000000000000000000000000000000000000") as Hex,
      quoteAddress: (config.gmeTokenAddress ||
        "0x0000000000000000000000000000000000000000") as Hex,
      chainId: config.chainId,
      factoryAddress: (config.ponsFactoryAddress || PONS_V2_FACTORY) as Hex,
      hookAddress: (config.ponsHookAddress || PONS_V2_HOOK) as Hex,
      poolManager: (config.uniswapV4PoolManager || UNISWAP_V4_POOL_MANAGER) as Hex,
      quoteDecimals: config.gmeTokenDecimals ?? 18,
    }),
  ];
}

/**
 * Live boot: never silently scan from block 0 when TOKEN is set on a
 * multi-million-tip chain. Tests that inject adapters skip this.
 */
export async function resolveLiveAdapters(): Promise<VenueAdapter[]> {
  const adapters = buildAdapters();
  if (config.fixtureMode) return adapters;
  if (!config.tokenAddress) return adapters;
  if (config.startBlock > 0) return adapters;

  let tip: bigint | null = null;
  if (config.rpcUrl) {
    try {
      tip = await createRpcReader(config.rpcUrl).getBlockNumber();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`START_BLOCK guard could not read chain tip (${message}).`);
      tip = null;
    }
  }
  const decision = genesisScanDecision({
    tokenAddress: config.tokenAddress,
    startBlock: config.startBlock,
    tipBlock: tip,
  });
  if (decision.message) console.error(decision.message);
  if (decision.refuse) return [];
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
    private readonly eoaGate: EoaGate | null = null,
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

  /**
   * Seed or rewind last_block to cover START_BLOCK.
   * Rewind is required when the process first came up after launch with a
   * later tip cursor, then START_BLOCK was set to the deploy block.
   */
  async ensureCursors(): Promise<void> {
    for (const adapter of this.adapters) {
      const { rows } = await this.pool.query<{
        last_block: string;
        start_block: string | null;
      }>(
        `SELECT last_block::text AS last_block, start_block::text AS start_block
         FROM indexer_cursor WHERE adapter = $1`,
        [adapter.name],
      );
      const existingLast = rows[0] ? BigInt(rows[0].last_block) : null;
      const existingStart =
        rows[0]?.start_block !== undefined &&
        rows[0]?.start_block !== null &&
        rows[0].start_block !== ""
          ? BigInt(rows[0].start_block)
          : null;
      const merged = bootCursor({
        startBlock: this.startBlock,
        existingLast,
        existingStart,
      });
      await this.pool.query(
        `INSERT INTO indexer_cursor (adapter, last_block, start_block)
         VALUES ($1, $2, $3)
         ON CONFLICT (adapter) DO UPDATE
           SET last_block = EXCLUDED.last_block,
               start_block = EXCLUDED.start_block,
               updated_at = NOW()`,
        [adapter.name, merged.toString(), this.startBlock.toString()],
      );
      if (existingLast !== null && merged < existingLast) {
        console.warn(
          `Indexer cursor ${adapter.name} rewound ${existingLast} → ${merged} so backfill can replay from START_BLOCK=${this.startBlock}.`,
        );
      }
    }
  }

  private async getCursor(adapter: string): Promise<bigint> {
    const { rows } = await this.pool.query<{ last_block: string }>(
      `SELECT last_block::text AS last_block FROM indexer_cursor WHERE adapter = $1`,
      [adapter],
    );
    if (!rows[0]) return cursorSeed(this.startBlock);
    return BigInt(rows[0].last_block);
  }

  private async setCursor(adapter: string, block: bigint): Promise<void> {
    await this.pool.query(
      `INSERT INTO indexer_cursor (adapter, last_block, start_block, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (adapter) DO UPDATE
         SET last_block = EXCLUDED.last_block,
             updated_at = NOW()`,
      [adapter, block.toString(), this.startBlock.toString()],
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `Indexer poll failed (cursor unchanged, tickets not skipped): ${message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Idempotent ingest: event_id primary key prevents double-count on restart.
   */
  async ingest(event: ChainTradeEvent): Promise<boolean> {
    const credited = await this.creditEvent(event);
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
          (credited?.wallet ?? event.wallet).toLowerCase(),
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

      if (credited) {
        this.runtime.applyEvent(credited);
      }
      await client.query("COMMIT");
      if (credited && this.onNewTrade) {
        await this.onNewTrade(credited);
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
  async replayAll(fixtureMode = config.fixtureMode): Promise<void> {
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
      fixtureMode
        ? `SELECT * FROM ingested_events
           ORDER BY block_number ASC, log_index ASC`
        : `SELECT * FROM ingested_events
           WHERE adapter <> 'fixture'
           ORDER BY block_number ASC, log_index ASC`,
    );

    this.runtime.live.clear();
    this.runtime.volumeGme = 0;
    this.runtime.volumeUsd = 0;
    this.runtime.snapshot = null;
    this.runtime.phase = "open";

    for (const row of rows) {
      const raw: ChainTradeEvent = {
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
      };
      const credited = await this.creditEvent(raw);
      if (credited) this.runtime.applyEvent(credited);
    }
  }

  /** Null means skip ticket credit (contract with no safe EOA unwrap). */
  private async creditEvent(
    event: ChainTradeEvent,
  ): Promise<ChainTradeEvent | null> {
    const gate = this.eoaGate ?? this.runtime.eoaGate;
    if (!gate) return event;
    const decision = await gate.creditForTrade({
      recipient: event.wallet,
      txHash: event.txHash,
    });
    if (decision.action === "skip") return null;
    if (decision.creditWallet && decision.creditWallet !== event.wallet.toLowerCase()) {
      return { ...event, wallet: decision.creditWallet };
    }
    return event;
  }
}
