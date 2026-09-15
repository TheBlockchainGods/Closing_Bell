"use client";

import { useSyncExternalStore } from "react";

import {
  isSessionLive,
  isWeekendCarry,
  nextWeeklySnapshot,
  remainingUntil,
  upcomingBells,
} from "./market-clock";
import type { BellOccurrence, Remaining } from "./types";

/**
 * One second-resolution clock shared by every countdown on the page, exposed
 * as an external store. The server snapshot is 0 so nothing time-dependent is
 * rendered until hydration, which keeps the markup deterministic.
 */

let tick = 0;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  tick = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (intervalId === null) {
    tick = Date.now();
    intervalId = window.setInterval(emit, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const getSnapshot = () => tick;
const getServerSnapshot = () => 0;

/** The current instant, or `null` before the clock has started on the client. */
export function useNow(): Date | null {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return current === 0 ? null : new Date(current);
}

export interface BellClock {
  ready: boolean;
  bells: BellOccurrence[];
  next: BellOccurrence | null;
  remaining: Remaining | null;
  sessionLive: boolean;
  /** True while the board is dark for the weekend and the pot is carrying. */
  weekend: boolean;
}

export function useBellClock(count = 3): BellClock {
  const now = useNow();

  if (!now) {
    return {
      ready: false,
      bells: [],
      next: null,
      remaining: null,
      sessionLive: false,
      weekend: false,
    };
  }

  const bells = upcomingBells(now, count);
  const next = bells[0] ?? null;

  return {
    ready: true,
    bells,
    next,
    remaining: next ? remainingUntil(next.at, now) : null,
    sessionLive: isSessionLive(now),
    weekend: isWeekendCarry(now),
  };
}

export interface SnapshotClock {
  ready: boolean;
  at: Date | null;
  remaining: Remaining | null;
}

export function useWeeklySnapshotClock(): SnapshotClock {
  const now = useNow();

  if (!now) return { ready: false, at: null, remaining: null };

  const at = nextWeeklySnapshot(now);
  return { ready: true, at, remaining: remainingUntil(at, now) };
}

const neverSubscribe = () => () => {};

/** True only after hydration. Useful for swapping in animated readouts. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverSubscribe,
    () => true,
    () => false,
  );
}
