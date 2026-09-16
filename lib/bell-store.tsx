"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { publicApiBase } from "./api-base";
import {
  fetchLiveOdds,
  fetchLiveSnapshot,
  mergeLiveLadder,
  type LiveOdds,
  type LiveSnapshot,
} from "./live-api";
import { AFTER_HOURS, isAddressLike } from "./mock-data";
import type {
  AfterHoursSnapshot,
  LadderRow,
  WalletLookup,
  WinnerRecord,
} from "./types";

export type RingPhase = "idle" | "ringing" | "settled";
export type FeedStatus = "loading" | "live" | "offline";

interface MutableState {
  inPotGme: number;
  accruingGme: number;
  gmePriceUsd: number;
  windowVolumeGme: number;
  totalTickets: number;
  totalPaidOutGme: number;
  oddsCap: number;
}

interface BellContextValue extends MutableState {
  potTotalGme: number;
  afterHours: AfterHoursSnapshot;
  afterHoursStatus: AfterHoursSnapshot["status"];
  afterHoursTargetStakedBell: number;
  afterHoursTargetPotGme: number;
  afterHoursTargetStakedShare: number;
  winners: WinnerRecord[];
  lastWinner: WinnerRecord | null;
  ringPhase: RingPhase;
  ringId: number;
  ringStartedAt: number;
  ringCooldownUntil: number;
  ladder: LadderRow[];
  watched: WalletLookup | null;
  watchedViaConnect: boolean;
  myRow: LadderRow | null;
  sampleLookups: string[];
  liveApi: boolean;
  fixtureMode: boolean;
  feedStatus: FeedStatus;
  oddsLookupError: string | null;
  ring: () => void;
  finishRing: () => void;
  dismissRing: () => void;
  watch: (address: string) => void;
  connectShortcut: () => void;
  clearWatch: () => void;
}

const EMPTY: MutableState = {
  inPotGme: 0,
  accruingGme: 0,
  gmePriceUsd: 0,
  windowVolumeGme: 0,
  totalTickets: 0,
  totalPaidOutGme: 0,
  oddsCap: 0.1,
};

const BellContext = createContext<BellContextValue | null>(null);

const RING_COOLDOWN_MS = 4_000;
const RING_SAFETY_MS = 60_000;
const LIVE_POLL_MS = 15_000;

function applySnapshot(snap: LiveSnapshot): MutableState {
  return {
    inPotGme: snap.pot.inPotGme,
    accruingGme: snap.pot.accruingGme,
    gmePriceUsd: snap.pot.gmePriceUsd,
    windowVolumeGme: snap.window.volumeGme,
    totalTickets: snap.window.ticketsOut,
    totalPaidOutGme: snap.totalPaidOutGme,
    oddsCap: snap.window.oddsCap,
  };
}

function lookupFromOdds(address: string, odds: LiveOdds | null): WalletLookup {
  if (odds) {
    return {
      address: odds.address,
      share: odds.share,
      onLadder: odds.tickets > 0,
    };
  }
  return { address, share: 0, onLadder: false };
}

export function BellProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MutableState>(EMPTY);
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [liveLadder, setLiveLadder] = useState<LadderRow[]>([]);
  const [sampleLookups, setSampleLookups] = useState<string[]>([]);
  const [lastWinner, setLastWinner] = useState<WinnerRecord | null>(null);
  const [ringPhase, setRingPhase] = useState<RingPhase>("idle");
  const [ringId, setRingId] = useState(0);
  const [ringStartedAt, setRingStartedAt] = useState(0);
  const [ringCooldownUntil, setRingCooldownUntil] = useState(0);
  const [watched, setWatched] = useState<WalletLookup | null>(null);
  const [watchedViaConnect, setWatchedViaConnect] = useState(false);
  const [liveOdds, setLiveOdds] = useState<LiveOdds | null>(null);
  const [liveApi, setLiveApi] = useState(false);
  const [fixtureMode, setFixtureMode] = useState(true);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [oddsLookupError, setOddsLookupError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<RingPhase>("idle");
  const cooldownRef = useRef(0);
  const watchedRef = useRef<WalletLookup | null>(null);
  watchedRef.current = watched;

  const apiBase = publicApiBase();

  useEffect(() => {
    phaseRef.current = ringPhase;
  }, [ringPhase]);

  useEffect(() => {
    cooldownRef.current = ringCooldownUntil;
  }, [ringCooldownUntil]);

  useEffect(() => {
    if (!apiBase) {
      setFeedStatus("offline");
      setLiveApi(false);
      return;
    }

    let cancelled = false;

    const pull = async () => {
      const snap = await fetchLiveSnapshot(apiBase);
      if (cancelled) return;
      if (!snap) {
        setLiveApi(false);
        setFeedStatus((prev) => (prev === "live" ? "live" : "offline"));
        return;
      }
      setLiveApi(true);
      setFeedStatus("live");
      setFixtureMode(snap.fixtureMode);
      setState(applySnapshot(snap));
      setWinners(snap.winners);
      setLiveLadder(snap.ladder);
      setSampleLookups(snap.sampleLookups);

      const current = watchedRef.current;
      if (current) {
        const odds = await fetchLiveOdds(apiBase, current.address);
        if (cancelled) return;
        if (odds) {
          setLiveOdds(odds);
          setOddsLookupError(null);
          setWatched(lookupFromOdds(current.address, odds));
        }
      }
    };

    void pull();
    const id = window.setInterval(() => {
      void pull();
    }, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apiBase]);

  const watch = useCallback(
    (raw: string) => {
      const address = raw.trim();
      if (!isAddressLike(address)) return;
      setWatchedViaConnect(false);
      setOddsLookupError(null);

      if (!apiBase) {
        setLiveOdds(null);
        setWatched({ address, share: 0, onLadder: false });
        setOddsLookupError("API is not configured.");
        return;
      }

      setWatched({ address, share: 0, onLadder: false });
      void (async () => {
        const odds = await fetchLiveOdds(apiBase, address);
        if (odds) {
          setLiveOdds(odds);
          setOddsLookupError(null);
          setWatched(lookupFromOdds(address, odds));
          return;
        }
        setLiveOdds(null);
        setOddsLookupError("Could not read odds from the API.");
      })();
    },
    [apiBase],
  );

  const connectShortcut = useCallback(() => {
    const sample = sampleLookups[0];
    if (!sample) return;
    setWatchedViaConnect(true);
    watch(sample);
  }, [sampleLookups, watch]);

  const clearWatch = useCallback(() => {
    setWatched(null);
    setWatchedViaConnect(false);
    setLiveOdds(null);
    setOddsLookupError(null);
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

    const safety = window.setTimeout(() => {
      if (phaseRef.current === "idle") return;
      setRingPhase("idle");
      phaseRef.current = "idle";
      setRingStartedAt(0);
      const until = Date.now() + RING_COOLDOWN_MS;
      cooldownRef.current = until;
      setRingCooldownUntil(until);
    }, RING_SAFETY_MS);
    timers.current.push(safety);
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
    setRingCooldownUntil(until);
  }, []);

  const dismissRing = useCallback(() => {
    setLastWinner(null);
    setRingPhase("idle");
    phaseRef.current = "idle";
    setRingStartedAt(0);
  }, []);

  useEffect(() => {
    const ids = timers.current;
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const ladder = useMemo(
    () => mergeLiveLadder(liveLadder, watched?.address ?? null, liveOdds),
    [liveLadder, liveOdds, watched],
  );

  const myRow = useMemo(
    () => ladder.find((row) => row.isYou) ?? null,
    [ladder],
  );

  const value = useMemo<BellContextValue>(
    () => ({
      ...state,
      potTotalGme: state.inPotGme + state.accruingGme,
      afterHours: AFTER_HOURS,
      afterHoursStatus: AFTER_HOURS.status,
      afterHoursTargetStakedBell: AFTER_HOURS.totalStakedBell,
      afterHoursTargetPotGme: AFTER_HOURS.weeklyPotGme,
      afterHoursTargetStakedShare: AFTER_HOURS.targetStakedShare,
      winners,
      lastWinner,
      ringPhase,
      ringId,
      ringStartedAt,
      ringCooldownUntil,
      ladder,
      watched,
      watchedViaConnect,
      myRow,
      sampleLookups,
      liveApi,
      fixtureMode,
      feedStatus,
      oddsLookupError,
      ring,
      finishRing,
      dismissRing,
      watch,
      connectShortcut,
      clearWatch,
    }),
    [
      state,
      winners,
      lastWinner,
      ringPhase,
      ringId,
      ringStartedAt,
      ringCooldownUntil,
      ladder,
      watched,
      watchedViaConnect,
      myRow,
      sampleLookups,
      liveApi,
      fixtureMode,
      feedStatus,
      oddsLookupError,
      ring,
      finishRing,
      dismissRing,
      watch,
      connectShortcut,
      clearWatch,
    ],
  );

  return <BellContext.Provider value={value}>{children}</BellContext.Provider>;
}

export function useBell(): BellContextValue {
  const ctx = useContext(BellContext);
  if (!ctx) throw new Error("useBell must be used inside BellProvider");
  return ctx;
}
