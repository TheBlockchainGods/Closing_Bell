import type { Pool } from "pg";

export type PaidDrawRow = {
  phase: string;
  dryRun: boolean;
  paidAmountGme: unknown;
};

/**
 * Lifetime GME actually sent. Paid draws only.
 * Dry-run, failed, and skipped rings contribute nothing.
 * Seed potBalance is not a payout: only receipt paidAmountGme counts.
 */
export function sumPaidDraws(rows: PaidDrawRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (row.phase !== "paid" || row.dryRun) continue;
    const raw = row.paidAmountGme;
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const text = String(raw).trim();
    if (!/^[0-9]+(\.[0-9]+)?$/.test(text)) continue;
    total += Number(text);
  }
  return total;
}

export function attachPaidOut<T extends { gmeUsdPrice: number }>(
  pot: T,
  totalPaidOutGme: number,
): T & { totalPaidOutGme: number; totalPaidOutUsd: number } {
  const paid = Number.isFinite(totalPaidOutGme) ? Math.max(0, totalPaidOutGme) : 0;
  return {
    ...pot,
    totalPaidOutGme: paid,
    totalPaidOutUsd: paid * (pot.gmeUsdPrice || 0),
  };
}

export async function sumPaidOutGme(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{
    phase: string;
    dry_run: boolean | null;
    paid: string | null;
  }>(
    `SELECT phase, dry_run, receipt_json->>'paidAmountGme' AS paid
     FROM draws`,
  );
  return sumPaidDraws(
    rows.map((row) => ({
      phase: String(row.phase ?? ""),
      dryRun: row.dry_run !== false,
      paidAmountGme: row.paid,
    })),
  );
}
