import Fastify from "fastify";

import { config } from "../config.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import { getPool } from "../db/client.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function buildServer(runtime: BellRuntime) {
  const app = Fastify({
    logger: {
      level: "info",
      // Redact anything that might accidentally include fee / marketing wallets.
      redact: {
        paths: [
          "feeWallet",
          "marketingWallet",
          "opsWallet",
          "devWallet",
          "FEE_WALLET",
          "MARKETING_WALLET",
          "JACKPOT_PRIVATE_KEY",
          "JACKPOT_WALLET_PRIVATE_KEY",
          "jackpotPrivateKey",
          "req.headers.authorization",
        ],
        remove: true,
      },
    },
  });

  app.get("/health", async () => {
    let db = "unknown";
    try {
      await getPool().query("SELECT 1");
      db = "ok";
    } catch {
      db = "down";
    }
    return {
      ok: db === "ok",
      db,
      ...config.publicMeta(),
      now: new Date().toISOString(),
    };
  });

  app.get("/pot", async () => {
    const pot = runtime.pot();
    return {
      ...pot,
      jackpotWallet: config.jackpotWallet || null,
      asOf: new Date().toISOString(),
    };
  });

  app.get("/share/jackpot.png", async (_req, reply) => {
    const { renderJackpotCard } = await import("../telegram/jackpot-card.js");
    const { publicSiteOrigin } = await import("../telegram/links.js");
    const png = await renderJackpotCard(runtime.pot(), publicSiteOrigin());
    return reply
      .header("content-type", "image/png")
      .header("cache-control", "no-store")
      .send(png);
  });

  app.get("/window/current", async () => {
    return runtime.currentWindow(new Date());
  });

  app.get<{ Querystring: { address?: string } }>("/odds", async (req, reply) => {
    const address = (req.query.address ?? "").trim();
    if (!ADDRESS_RE.test(address)) {
      return reply.code(400).send({
        error: "Invalid address",
        message: "Query param address must be a 0x-prefixed 40-byte hex string",
      });
    }
    const odds = runtime.oddsFor(address);
    return {
      ...odds,
      message: odds.message ?? (odds.tickets > 0 ? undefined : "No tickets this window"),
    };
  });

  app.get("/fixture/trades", async (_req, reply) => {
    if (!config.fixtureMode) {
      return reply.code(404).send({
        error: "Not found",
        message: "Fixture trades are only listed while FIXTURE_MODE=true",
      });
    }
    const { loadFixtureRows } = await import("../indexer/adapters/fixture.js");
    const rows = loadFixtureRows();
    return {
      fixtureMode: true,
      count: rows.length,
      trades: rows.map((row) => ({
        txHash: row.txHash,
        logIndex: row.logIndex,
        kind: row.kind,
        wallet: row.wallet.toLowerCase(),
        gmeAmount: row.gmeAmount,
        bellAmount: row.bellAmount,
        occurredAt: row.occurredAt,
      })),
    };
  });

  app.get<{ Querystring: { limit?: string } }>("/ladder", async (req) => {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit ?? 20) || 20),
    );
    const window = runtime.currentWindow(new Date());
    return {
      phase: window.phase,
      ticketsOut:
        window.phase === "locked" && window.snapshotTicketsOut !== null
          ? window.snapshotTicketsOut
          : window.ticketsOut,
      oddsCapBps: config.oddsCapBps,
      rows: runtime.ladder(limit),
    };
  });

  app.get<{ Querystring: { limit?: string } }>("/winners", async (req) => {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit ?? 20) || 20),
    );
    const { rows } = await getPool().query(
      `SELECT id, address, kind, amount_gme, tickets_at_ring, odds_at_ring,
              ringed_at, carried_weekend, window_id, tx_hash, dry_run
       FROM winners
       ORDER BY ringed_at DESC
       LIMIT $1`,
      [limit],
    );
    return {
      rows: rows.map((row) => ({
        id: row.id,
        address: row.address,
        kind: row.kind,
        amountGme: Number(row.amount_gme),
        ticketsAtRing: Number(row.tickets_at_ring),
        oddsAtRing: Number(row.odds_at_ring),
        ringedAt: new Date(row.ringed_at).toISOString(),
        carriedWeekend: Boolean(row.carried_weekend),
        windowId: row.window_id ?? null,
        txHash: row.tx_hash ?? null,
        dryRun: row.dry_run !== false,
      })),
    };
  });

  /**
   * Public ring receipt for /verify.
   * Prefer windowId (draws.receipt_json). Falls back to winner id lookup.
   */
  app.get<{ Params: { windowId: string } }>(
    "/winners/:windowId",
    async (req, reply) => {
      const windowId = decodeURIComponent(req.params.windowId).trim();
      if (!windowId) {
        return reply.code(400).send({
          error: "Invalid windowId",
          message: "windowId is required",
        });
      }

      const { rows } = await getPool().query(
        `SELECT d.window_id, d.phase, d.dry_run, d.receipt_json,
                d.winner, d.blockhash, d.pot_gme, d.total_weight,
                d.tx_hash, d.settled_at, d.bell_at
         FROM draws d
         WHERE d.window_id = $1
         LIMIT 1`,
        [windowId],
      );

      let row = rows[0];
      if (!row) {
        const byWinner = await getPool().query(
          `SELECT d.window_id, d.phase, d.dry_run, d.receipt_json,
                  d.winner, d.blockhash, d.pot_gme, d.total_weight,
                  d.tx_hash, d.settled_at, d.bell_at
           FROM winners w
           JOIN draws d ON d.window_id = COALESCE(w.window_id, w.id)
           WHERE w.id = $1 OR w.window_id = $1
           LIMIT 1`,
          [windowId],
        );
        row = byWinner.rows[0];
      }

      if (!row) {
        return reply.code(404).send({
          error: "Not found",
          message: `No receipt for windowId ${windowId}`,
        });
      }

      if (row.receipt_json) {
        return {
          windowId: row.window_id,
          phase: row.phase,
          dryRun: row.dry_run !== false,
          receipt: row.receipt_json,
        };
      }

      return reply.code(404).send({
        error: "Receipt unavailable",
        message:
          "This ring settled before receipts were published. Recompute needs a published receipt JSON.",
        windowId: row.window_id,
        phase: row.phase,
        winner: row.winner ?? null,
        blockhash: row.blockhash ?? null,
        potGme:
          row.pot_gme === null || row.pot_gme === undefined
            ? null
            : Number(row.pot_gme),
        totalWeight:
          row.total_weight === null || row.total_weight === undefined
            ? null
            : Number(row.total_weight),
        txHash: row.tx_hash ?? null,
        dryRun: row.dry_run !== false,
      });
    },
  );

  return app;
}
