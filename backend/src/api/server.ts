import Fastify from "fastify";
import {
  receiptSettledPaidGme,
  type RingReceipt,
} from "@closing-bell/fairness";

import { config } from "../config.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import { getPool } from "../db/client.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function asReceipt(value: unknown): RingReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RingReceipt;
}

function overlayReceiptPayout(
  receipt: unknown,
  paidAmountGme: string | number | null,
  txHash: string | null,
): unknown {
  const base = asReceipt(receipt);
  if (!base) return receipt;
  const settled = receiptSettledPaidGme(base);
  const next: RingReceipt = { ...base };
  if (settled === null && paidAmountGme !== null && paidAmountGme !== "") {
    next.paidAmountGme = paidAmountGme;
  }
  if (!next.txHash && txHash) next.txHash = txHash;
  return next;
}

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
    const pot = await runtime.refreshPot();
    return {
      ...pot,
      jackpotWallet: config.jackpotWallet || null,
      asOf: new Date().toISOString(),
    };
  });

  app.get("/share/jackpot.png", async (_req, reply) => {
    const { renderJackpotCard } = await import("../telegram/jackpot-card.js");
    const { publicSiteOrigin } = await import("../telegram/links.js");
    const png = await renderJackpotCard(
      await runtime.refreshPot(),
      publicSiteOrigin(),
    );
    return reply
      .header("content-type", "image/png")
      .header("cache-control", "no-store")
      .send(png);
  });

  app.get("/window/current", async () => {
    const window = runtime.currentWindow(new Date());
    const hideFixturePool = !config.fixtureMode && !config.tokenAddress;
    if (!hideFixturePool) return window;
    return {
      ...window,
      ticketsOut: 0,
      volumeGme: 0,
      volumeUsd: 0,
      snapshotTicketsOut: null,
    };
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
    const hideFixturePool = !config.fixtureMode && !config.tokenAddress;
    return {
      phase: window.phase,
      ticketsOut: hideFixturePool
        ? 0
        : window.phase === "locked" && window.snapshotTicketsOut !== null
          ? window.snapshotTicketsOut
          : window.ticketsOut,
      oddsCapBps: config.oddsCapBps,
      rows: hideFixturePool ? [] : runtime.ladder(limit),
    };
  });

  app.get<{ Querystring: { limit?: string } }>("/winners", async (req) => {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit ?? 20) || 20),
    );
    const { rows } = await getPool().query(
      `SELECT w.id, w.address, w.kind, w.amount_gme, w.tickets_at_ring, w.odds_at_ring,
              w.ringed_at, w.carried_weekend, w.window_id, w.tx_hash, w.dry_run,
              d.receipt_json, d.tx_hash AS draw_tx_hash
       FROM winners w
       LEFT JOIN draws d ON d.window_id = COALESCE(w.window_id, w.id)
       ORDER BY w.ringed_at DESC
       LIMIT $1`,
      [limit],
    );
    return {
      rows: rows.map((row) => {
        const receipt = asReceipt(row.receipt_json);
        const settled = receipt ? receiptSettledPaidGme(receipt) : null;
        const txHash =
          (typeof row.tx_hash === "string" && row.tx_hash) ||
          (typeof row.draw_tx_hash === "string" && row.draw_tx_hash) ||
          (receipt?.txHash ?? null);
        return {
          id: row.id,
          address: row.address,
          kind: row.kind,
          amountGme: settled ?? Number(row.amount_gme),
          ticketsAtRing: Number(row.tickets_at_ring),
          oddsAtRing: Number(row.odds_at_ring),
          ringedAt: new Date(row.ringed_at).toISOString(),
          carriedWeekend: Boolean(row.carried_weekend),
          windowId: row.window_id ?? null,
          txHash,
          dryRun: row.dry_run !== false,
        };
      }),
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
          receipt: overlayReceiptPayout(
            row.receipt_json,
            null,
            row.tx_hash ?? null,
          ),
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
