import type { BellKind, LadderRow, WinnerRecord } from "./types";

export interface LivePot {
  inPotGme: number;
  accruingGme: number;
  gmePriceUsd: number;
  displayPotGme: number;
}

export interface LiveWindow {
  volumeGme: number;
  ticketsOut: number;
  oddsCap: number;
}

export interface LiveOdds {
  address: string;
  tickets: number;
  share: number;
  odds: number;
  capped: boolean;
  spentInWindowGme: number;
}

export interface LiveSnapshot {
  fixtureMode: boolean;
  dryRunPayouts: boolean;
  pot: LivePot;
  window: LiveWindow;
  ladder: LadderRow[];
  winners: WinnerRecord[];
  totalPaidOutGme: number;
  sampleLookups: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asBellKind(value: unknown): BellKind {
  if (value === "open" || value === "lunch" || value === "close") return value;
  return "close";
}

async function getJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function parseLadder(payload: unknown): LadderRow[] {
  const root = asRecord(payload);
  const rows = Array.isArray(root?.rows) ? root.rows : [];
  return rows.flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const address = asString(rec.address);
    if (!address) return [];
    return [
      {
        rank: asNumber(rec.rank, index + 1),
        address,
        tickets: asNumber(rec.tickets),
        spentInWindowGme: asNumber(rec.spentInWindowGme),
        share: asNumber(rec.share),
        odds: asNumber(rec.odds),
        capped: asBool(rec.capped),
        isYou: false,
      },
    ];
  });
}

function parseWinners(payload: unknown): WinnerRecord[] {
  const root = asRecord(payload);
  const rows = Array.isArray(root?.rows) ? root.rows : [];
  return rows.flatMap((row) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const address = asString(rec.address);
    const id = asString(rec.id);
    if (!address || !id) return [];
    return [
      {
        id,
        address,
        kind: asBellKind(rec.kind),
        amountGme: asNumber(rec.amountGme),
        ticketsAtRing: asNumber(rec.ticketsAtRing),
        oddsAtRing: asNumber(rec.oddsAtRing),
        ringedAt: asString(rec.ringedAt, new Date().toISOString()),
        simulated: false,
        carriedWeekend: asBool(rec.carriedWeekend, false),
      },
    ];
  });
}

export async function fetchLiveSnapshot(
  base: string,
): Promise<LiveSnapshot | null> {
  const [healthRaw, potRaw, windowRaw, ladderRaw, winnersRaw] =
    await Promise.all([
      getJson(`${base}/health`),
      getJson(`${base}/pot`),
      getJson(`${base}/window/current`),
      getJson(`${base}/ladder?limit=20`),
      getJson(`${base}/winners?limit=20`),
    ]);

  const health = asRecord(healthRaw);
  const pot = asRecord(potRaw);
  const windowSnap = asRecord(windowRaw);
  if (!health || !pot || !windowSnap) return null;

  const ladder = parseLadder(ladderRaw);
  const winners = parseWinners(winnersRaw);
  const ticketsOut = asNumber(
    windowSnap.ticketsOut,
    asNumber(asRecord(ladderRaw)?.ticketsOut, ladder.reduce((s, r) => s + r.tickets, 0)),
  );
  const oddsCapBps = asNumber(health.oddsCapBps, asNumber(asRecord(ladderRaw)?.oddsCapBps, 1000));

  return {
    fixtureMode: asBool(health.fixtureMode, true),
    dryRunPayouts: asBool(health.dryRunPayouts, true),
    pot: {
      inPotGme: asNumber(pot.inPot),
      accruingGme: asNumber(pot.accruingUnclaimed),
      gmePriceUsd: asNumber(pot.gmeUsdPrice),
      displayPotGme: asNumber(pot.displayPot, asNumber(pot.inPot) + asNumber(pot.accruingUnclaimed)),
    },
    window: {
      volumeGme: asNumber(windowSnap.volumeGme),
      ticketsOut,
      oddsCap: oddsCapBps / 10_000,
    },
    ladder,
    winners,
    totalPaidOutGme: winners.reduce((sum, row) => sum + row.amountGme, 0),
    sampleLookups: ladder.slice(0, 3).map((row) => row.address),
  };
}

export async function fetchLiveOdds(
  base: string,
  address: string,
): Promise<LiveOdds | null> {
  const raw = await getJson(
    `${base}/odds?address=${encodeURIComponent(address)}`,
  );
  const rec = asRecord(raw);
  if (!rec || rec.error) return null;
  const resolved = asString(rec.address, address);
  return {
    address: resolved,
    tickets: asNumber(rec.tickets),
    share: asNumber(rec.share),
    odds: asNumber(rec.odds),
    capped: asBool(rec.capped),
    spentInWindowGme: asNumber(rec.spentInWindowGme),
  };
}

export function mergeLiveLadder(
  liveRows: LadderRow[],
  watchedAddress: string | null,
  extra: LiveOdds | null,
): LadderRow[] {
  const byAddr = new Map<string, LadderRow>();
  for (const row of liveRows) {
    byAddr.set(row.address.toLowerCase(), { ...row, isYou: false });
  }

  if (watchedAddress) {
    const key = watchedAddress.toLowerCase();
    const existing = byAddr.get(key);
    if (existing) {
      existing.isYou = true;
    } else if (extra && extra.address.toLowerCase() === key) {
      byAddr.set(key, {
        rank: 0,
        address: extra.address,
        tickets: extra.tickets,
        spentInWindowGme: extra.spentInWindowGme,
        share: extra.share,
        odds: extra.odds,
        capped: extra.capped,
        isYou: true,
      });
    } else {
      byAddr.set(key, {
        rank: 0,
        address: watchedAddress,
        tickets: 0,
        spentInWindowGme: 0,
        share: 0,
        odds: 0,
        capped: false,
        isYou: true,
      });
    }
  }

  return [...byAddr.values()]
    .sort((a, b) => b.tickets - a.tickets || a.address.localeCompare(b.address))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
