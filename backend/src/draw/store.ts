import type { Pool } from "pg";

export type DrawPhase =
  | "locked"
  | "skipped"
  | "dry_run"
  | "paid"
  | "failed";

export interface DrawRow {
  windowId: string;
  bellKind: string;
  bellAt: Date;
  phase: DrawPhase;
  snapshotAt: Date | null;
  blockhash: string | null;
  potGme: number | null;
  totalWeight: number | null;
  winner: string | null;
  ticketsAtRing: number | null;
  oddsAtRing: number | null;
  txHash: string | null;
  dryRun: boolean;
  skipReason: string | null;
  carriedWeekend: boolean;
  settledAt: Date | null;
  /** Published ring receipt JSON for public /verify, when settled. */
  receiptJson: unknown | null;
}

export class DrawStore {
  constructor(private readonly pool: Pool) {}

  async get(windowId: string): Promise<DrawRow | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM draws WHERE window_id = $1`,
      [windowId],
    );
    if (!rows[0]) return null;
    return mapDraw(rows[0]);
  }

  /** Insert locked row; no-op if window already exists (one draw per window). */
  async tryLock(input: {
    windowId: string;
    bellKind: string;
    bellAt: Date;
    snapshotAt: Date;
    blockhash: string;
    carriedWeekend: boolean;
  }): Promise<{ inserted: boolean; row: DrawRow }> {
    const inserted = await this.pool.query(
      `INSERT INTO draws (
         window_id, bell_kind, bell_at, phase, snapshot_at, blockhash,
         dry_run, carried_weekend
       ) VALUES ($1,$2,$3,'locked',$4,$5,TRUE,$6)
       ON CONFLICT (window_id) DO NOTHING
       RETURNING *`,
      [
        input.windowId,
        input.bellKind,
        input.bellAt.toISOString(),
        input.snapshotAt.toISOString(),
        input.blockhash,
        input.carriedWeekend,
      ],
    );
    if (inserted.rows[0]) {
      return { inserted: true, row: mapDraw(inserted.rows[0]) };
    }
    const existing = await this.get(input.windowId);
    if (!existing) {
      throw new Error(`draw missing after conflict: ${input.windowId}`);
    }
    return { inserted: false, row: existing };
  }

  async markSkipped(
    windowId: string,
    reason: string,
    potGme: number,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE draws
       SET phase = 'skipped',
           skip_reason = $2,
           pot_gme = $3,
           settled_at = NOW()
       WHERE window_id = $1
         AND phase = 'locked'`,
      [windowId, reason, potGme],
    );
  }

  async markSettled(input: {
    windowId: string;
    phase: "dry_run" | "paid" | "failed";
    potGme: number;
    totalWeight: number;
    winner: string;
    ticketsAtRing: number;
    oddsAtRing: number;
    txHash: string | null;
    dryRun: boolean;
    skipReason?: string | null;
    receiptJson?: unknown | null;
  }): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE draws
       SET phase = $2,
           pot_gme = $3,
           total_weight = $4,
           winner = $5,
           tickets_at_ring = $6,
           odds_at_ring = $7,
           tx_hash = $8,
           dry_run = $9,
           skip_reason = $10,
           receipt_json = $11,
           settled_at = NOW()
       WHERE window_id = $1
         AND phase = 'locked'
       RETURNING window_id`,
      [
        input.windowId,
        input.phase,
        input.potGme,
        input.totalWeight,
        input.winner,
        input.ticketsAtRing,
        input.oddsAtRing,
        input.txHash,
        input.dryRun,
        input.skipReason ?? null,
        input.receiptJson ?? null,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getReceipt(windowId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `SELECT receipt_json FROM draws WHERE window_id = $1`,
      [windowId],
    );
    if (!rows[0] || rows[0].receipt_json == null) return null;
    return rows[0].receipt_json;
  }

  async insertWinner(input: {
    id: string;
    address: string;
    kind: string;
    amountGme: number;
    ticketsAtRing: number;
    oddsAtRing: number;
    ringedAt: Date;
    carriedWeekend: boolean;
    windowId: string;
    txHash: string | null;
    dryRun: boolean;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO winners (
         id, address, kind, amount_gme, tickets_at_ring, odds_at_ring,
         ringed_at, carried_weekend, window_id, tx_hash, dry_run
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        input.id,
        input.address,
        input.kind,
        input.amountGme,
        input.ticketsAtRing,
        input.oddsAtRing,
        input.ringedAt.toISOString(),
        input.carriedWeekend,
        input.windowId,
        input.txHash,
        input.dryRun,
      ],
    );
  }
}

function mapDraw(row: Record<string, unknown>): DrawRow {
  return {
    windowId: String(row.window_id),
    bellKind: String(row.bell_kind),
    bellAt: new Date(String(row.bell_at)),
    phase: row.phase as DrawPhase,
    snapshotAt: row.snapshot_at ? new Date(String(row.snapshot_at)) : null,
    blockhash: row.blockhash ? String(row.blockhash) : null,
    potGme: row.pot_gme === null || row.pot_gme === undefined ? null : Number(row.pot_gme),
    totalWeight:
      row.total_weight === null || row.total_weight === undefined
        ? null
        : Number(row.total_weight),
    winner: row.winner ? String(row.winner) : null,
    ticketsAtRing:
      row.tickets_at_ring === null || row.tickets_at_ring === undefined
        ? null
        : Number(row.tickets_at_ring),
    oddsAtRing:
      row.odds_at_ring === null || row.odds_at_ring === undefined
        ? null
        : Number(row.odds_at_ring),
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    dryRun: Boolean(row.dry_run),
    skipReason: row.skip_reason ? String(row.skip_reason) : null,
    carriedWeekend: Boolean(row.carried_weekend),
    settledAt: row.settled_at ? new Date(String(row.settled_at)) : null,
    receiptJson: row.receipt_json ?? null,
  };
}
