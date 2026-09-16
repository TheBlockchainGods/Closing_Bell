"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AFTER_HOURS,
  MARKET,
  POT,
  STANDING_SHARES,
  TICKETS_PER_GME,
  WALLET,
  WINNERS,
  mockLookup,
} from "./mock-data";
import { nextBell } from "./market-clock";
import type {
  BellKind,
  LadderRow,
  WalletLookup,
  WinnerRecord,
} from "./types";

/**
 * Mocked application state for the landing page.
 *
 * This is the single seam between the UI and a future chain integration:
 * replace the reducers below with contract writes and the polling block with
 * indexer subscriptions, and every component keeps working unchanged.
 */

export type RingPhase = "idle" | "ringing" | "settled";

interface StoreValue {
  inPotGme: number;
  accruingGme: number;
  gmePriceUsd: number;
  bellPriceUsd: number;
  windowVolumeGme: number;
  totalTickets: number;
  holders: number;
  oddsCap: number;

  /** All-time GME paid out across settled rings (includes demo rings this session). */
  totalPaidOutGme: number;

  /** After Hours is a roadmap item, so these are targets rather than balances. */
  afterHoursStatus: "live" | "coming-soon";
  afterHoursTargetStakedBell: number;
  afterHoursTargetPotGme: number;
  afterHoursTargetStakedShare: number;

  /**
   * The address the visitor is inspecting. Set by pasting an address or by the
   * mock connect shortcut; no wallet library is involved either way.
   */
  watched: WalletLookup | null;
  /** True when the address came from the connect shortcut rather than a paste. */
  watchedViaConnect: boolean;
  /** Ladder for the current window, cap applied, watched address folded in. */
  ladder: LadderRow[];
  /** The watched address's ladder row, sized to the current window. */
  myRow: LadderRow | null;

  winners: WinnerRecord[];
  ringPhase: RingPhase;
  ringId: number;
  /** Client epoch ms when the current demo ring began; 0 when idle. */
  ringStartedAt: number;
  lastWinner: WinnerRecord | null;

  /** Total GME payable on the next ring. */
  potTotalGme: number;

  /** Epoch ms when the post-ring cooldown clears; 0 when free. */
  ringCooldownUntil: number;

  watch: (address: string) => void;
  clearWatch: () => void;
  connectShortcut: () => void;
  ring: () => void;
  /** Ends the ring ceremony (after gavel clip `ended`) and starts cooldown. */
  finishRing: () => void;
  dismissRing: () => void;
}

const BellContext = createContext<StoreValue | null>(null);

interface MutableState {
  inPotGme: number;
  accruingGme: number;
  gmePriceUsd: number;
  windowVolumeGme: number;
  totalTickets: number;
  totalPaidOutGme: number;
}

const INITIAL: MutableState = {
  inPotGme: POT.inPotGme,
  accruingGme: POT.accruingGme,
  gmePriceUsd: POT.gmePriceUsd,
  windowVolumeGme: MARKET.windowVolumeGme,
  totalTickets: MARKET.totalTickets,
  totalPaidOutGme: POT.totalPaidOutGme,
};

/** Demo ring cooldown after the gavel clip finishes, in ms. */
const RING_COOLDOWN_MS = 4_000;
/** Settle the mock pot shortly after the strike starts (not tied to clip length). */
const RING_SETTLE_MS = 900;
/** Safety only: force-release if `ended` never fires. */
const RING_SAFETY_MS = 60_000;

function pickWeightedWinner(
  entrants: { address: string; tickets: number }[],
): { address: string; tickets: number } | null {
  const pool = entrants.filter((entrant) => entrant.tickets > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, entrant) => sum + entrant.tickets, 0);
  let cursor = Math.random() * total;
  for (const entrant of pool) {
    cursor -= entrant.tickets;
    if (cursor <= 0) return entrant;
  }
  return pool[pool.length - 1];
}

/**
 * Ladder rows with the per-wallet cap applied.
 *
 * Rows are held as shares of the window rather than absolute counts, so the
 * ladder stays coherent at any window size, including the moment right after a
 * ring wipes every ticket. Both numbers are kept: the odds actually paid, and
 * whether the cap is the thing holding them down.
 */
function buildLadder(
  totalTickets: number,
  watched: WalletLookup | null,
): LadderRow[] {
  const rows = STANDING_SHARES.map((row) => ({
    address: row.address,
    share: row.share,
    isYou: false,
  }));

  if (watched) {
    const existing = rows.find(
      (row) => row.address.toLowerCase() === watched.address.toLowerCase(),
    );
    if (existing) {
      existing.isYou = true;
    } else {
      rows.push({
        address: watched.address,
        share: watched.share,
        isYou: true,
      });
    }
  }

  return rows
    .sort((a, b) => b.share - a.share)
    .map((row, index) => {
      const tickets = Math.round(row.share * totalTickets);
      return {
        address: row.address,
        isYou: row.isYou,
        share: row.share,
        rank: index + 1,
        tickets,
        spentInWindowGme: tickets / TICKETS_PER_GME,
        odds: Math.min(MARKET.oddsCap, row.share),
        capped: row.share > MARKET.oddsCap,
      };
    });
}

export function BellProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MutableState>(INITIAL);
  const [winners, setWinners] = useState<WinnerRecord[]>(WINNERS);
  const [ringPhase, setRingPhase] = useState<RingPhase>("idle");
  const [ringId, setRingId] = useState(0);
  const [ringStartedAt, setRingStartedAt] = useState(0);
  const [lastWinner, setLastWinner] = useState<WinnerRecord | null>(null);
  const [watched, setWatched] = useState<WalletLookup | null>(null);
  const [watchedViaConnect, setWatchedViaConnect] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const phaseRef = useRef<RingPhase>("idle");
  const stateRef = useRef(state);
  const watchedRef = useRef(watched);
  const cooldownRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    phaseRef.current = ringPhase;
  }, [ringPhase]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    watchedRef.current = watched;
  }, [watched]);

  useEffect(() => {
    cooldownRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  /** Session drift: the pot never stands still while the tape is running. */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (phaseRef.current === "ringing") return;
      setState((prev) => {
        const accrued = 0.42 + Math.random() * 2.1;
        const sweep = Math.random() < 0.34 ? prev.accruingGme * 0.55 : 0;
        return {
          ...prev,
          accruingGme: prev.accruingGme + accrued - sweep,
          inPotGme: prev.inPotGme + sweep,
          windowVolumeGme: prev.windowVolumeGme + accrued * 26,
          totalTickets:
            prev.totalTickets + Math.round(600 + Math.random() * 2600),
          gmePriceUsd: Math.max(
            1,
            prev.gmePriceUsd + (Math.random() - 0.48) * 0.05,
          ),
        };
      });
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  const watch = useCallback((address: string) => {
    const found = mockLookup(address);
    if (!found) return;
    setWatched(found);
    setWatchedViaConnect(false);
  }, []);

  const clearWatch = useCallback(() => {
    setWatched(null);
    setWatchedViaConnect(false);
  }, []);

  /** Fills the address field from a "wallet", without any wallet library. */
  const connectShortcut = useCallback(() => {
    const found = mockLookup(WALLET.address);
    if (!found) return;
    setWatched(found);
    setWatchedViaConnect(true);
  }, []);

  const ring = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    if (Date.now() < cooldownRef.current) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    phaseRef.current = "ringing";
    setRingPhase("ringing");
    setRingId((id) => id + 1);
    setRingStartedAt(Date.now());

    const settle = window.setTimeout(() => {
      // Read the snapshot outside the updater: state updaters must stay pure.
      const current = stateRef.current;
      const watchedNow = watchedRef.current;
      const upcoming = nextBell(new Date());
      const kind: BellKind = upcoming?.kind ?? "close";
      const payout = current.inPotGme + current.accruingGme;

      const ladder = buildLadder(current.totalTickets, watchedNow);
      const drawn = pickWeightedWinner(ladder);

      if (drawn) {
        const row = ladder.find((entry) => entry.address === drawn.address);
        const record: WinnerRecord = {
          id: `ring-demo-${Date.now()}`,
          address: drawn.address,
          kind,
          amountGme: payout,
          ticketsAtRing: Math.round(drawn.tickets),
          oddsAtRing: row?.odds ?? 0,
          ringedAt: new Date().toISOString(),
          simulated: true,
        };
        setLastWinner(record);
        setWinners((prevWinners) => [record, ...prevWinners].slice(0, 6));
      }

      setState((prev) => ({
        ...prev,
        inPotGme: 0,
        accruingGme: 0,
        totalTickets: 0,
        windowVolumeGme: 0,
        totalPaidOutGme: prev.totalPaidOutGme + payout,
      }));

      if (phaseRef.current === "ringing") {
        setRingPhase("settled");
        phaseRef.current = "settled";
      }
    }, RING_SETTLE_MS);

    // Do not hide the gavel clip with a short release timer. finishRing() runs
    // from the video `ended` handler. Safety unlock only.
    const safety = window.setTimeout(() => {
      if (phaseRef.current === "idle") return;
      setRingPhase("idle");
      phaseRef.current = "idle";
      setRingStartedAt(0);
      const until = Date.now() + RING_COOLDOWN_MS;
      cooldownRef.current = until;
      setCooldownUntil(until);
    }, RING_SAFETY_MS);

    timers.current.push(settle, safety);
  }, []);

  const finishRing = useCallback(() => {
    if (phaseRef.current === "idle") return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRingPhase("idle");
    phaseRef.current = "idle";
    setRingStartedAt(0);
    const until = Date.now() + RING_COOLDOWN_MS;
    cooldownRef.current = until;
    setCooldownUntil(until);
  }, []);

  const dismissRing = useCallback(() => {
    setRingPhase("idle");
    phaseRef.current = "idle";
    setRingStartedAt(0);
    setLastWinner(null);
  }, []);

  const value = useMemo<StoreValue>(() => {
    const ladder = buildLadder(state.totalTickets, watched);
    const mine = ladder.find((row) => row.isYou);

    return {
      ...state,
      bellPriceUsd: MARKET.bellPriceUsd,
      holders: MARKET.holders,
      oddsCap: MARKET.oddsCap,

      afterHoursStatus: AFTER_HOURS.status,
      afterHoursTargetStakedBell: AFTER_HOURS.totalStakedBell,
      afterHoursTargetPotGme: AFTER_HOURS.weeklyPotGme,
      afterHoursTargetStakedShare: AFTER_HOURS.targetStakedShare,

      watched,
      watchedViaConnect,
      ladder,
      myRow: mine ?? null,

      winners,
      ringPhase,
      ringId,
      ringStartedAt,
      lastWinner,
      potTotalGme: state.inPotGme + state.accruingGme,
      ringCooldownUntil: cooldownUntil,

      watch,
      clearWatch,
      connectShortcut,
      ring,
      finishRing,
      dismissRing,
    };
  }, [
    state,
    watched,
    watchedViaConnect,
    winners,
    ringPhase,
    ringId,
    ringStartedAt,
    lastWinner,
    cooldownUntil,
    watch,
    clearWatch,
    connectShortcut,
    ring,
    finishRing,
    dismissRing,
  ]);

  return <BellContext.Provider value={value}>{children}</BellContext.Provider>;
}

export function useBell(): StoreValue {
  const context = useContext(BellContext);
  if (!context) {
    throw new Error("useBell must be used inside <BellProvider>");
  }
  return context;
}
