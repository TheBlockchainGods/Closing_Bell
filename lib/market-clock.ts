import type { BellDefinition, BellOccurrence, BellKind, Remaining } from "./types";

export const ET_ZONE = "America/New_York";

/**
 * When true (the product default), bells ring every calendar day at the
 * scheduled ET times. When false, weekends are skipped like an exchange calendar.
 * Mirrors backend BELLS_24_7.
 */
export const BELLS_24_7 = true;

/**
 * The bell schedule, in America/New_York wall time.
 * Lunch Bell is optional and controlled by `INCLUDE_LUNCH_BELL`.
 */
export const BELL_SCHEDULE: BellDefinition[] = [
  {
    kind: "open",
    label: "Open Bell",
    hourEt: 9,
    minuteEt: 30,
    note: "First ring of the day. Pays out everything that accrued overnight.",
  },
  {
    kind: "lunch",
    label: "Lunch Bell",
    hourEt: 12,
    minuteEt: 30,
    note: "Midday ring. Smaller pot, same rules.",
  },
  {
    kind: "close",
    label: "Close Bell",
    hourEt: 16,
    minuteEt: 0,
    note: "The main event. Largest pot of the day, then every ticket wipes.",
  },
];

export const INCLUDE_LUNCH_BELL = true;

/** Seconds before the bell when the ticket bag freezes for the draw. */
export const SNAPSHOT_LEAD_SECONDS = 120;

/** Instant when the ticket bag locks for a given bell. */
export function bagLockAt(bellAt: Date): Date {
  return new Date(bellAt.getTime() - SNAPSHOT_LEAD_SECONDS * 1000);
}

const etPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface EtParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

/** Wall-clock parts of an instant, as seen in America/New_York. */
export function etParts(instant: Date): EtParts {
  const parts = etPartsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  let hour = Number(read("hour"));
  // Some ICU builds emit hour "24" for midnight in hour12: false.
  if (hour === 24) hour = 0;

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: WEEKDAY_INDEX[read("weekday")] ?? 0,
  };
}

/** Minutes that ET is offset from UTC at a given instant (negative west of UTC). */
function etOffsetMinutes(instant: Date): number {
  const parts = etParts(instant);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Convert an ET wall-clock time into an absolute instant.
 * Resolved twice so daylight-saving transitions land on the right side.
 */
export function etWallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(naive - etOffsetMinutes(new Date(naive)) * 60_000);
  instant = new Date(naive - etOffsetMinutes(instant) * 60_000);
  return instant;
}

/** Used only when BELLS_24_7 is false. */
export function isTradingDay(weekday: number): boolean {
  return weekday !== 0 && weekday !== 6;
}

interface EtDate {
  year: number;
  month: number;
  day: number;
}

function addDaysToEtDate(parts: EtDate, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * The next `count` bells after `now`.
 *
 * With BELLS_24_7 (default), every calendar day counts. With it off, weekends
 * are skipped and the first bell after a closed day is flagged carriesWeekend.
 */
export function upcomingBells(
  now: Date,
  count = 3,
  includeLunch = INCLUDE_LUNCH_BELL,
): BellOccurrence[] {
  const schedule = BELL_SCHEDULE.filter(
    (bell) => includeLunch || bell.kind !== "lunch",
  );
  const today = etParts(now);
  const found: BellOccurrence[] = [];

  for (let offset = 0; offset < 14 && found.length < count; offset += 1) {
    const date = addDaysToEtDate(today, offset);
    if (!BELLS_24_7 && !isTradingDay(date.weekday)) continue;

    const previous = addDaysToEtDate(date, -1);
    const afterClosedDay =
      !BELLS_24_7 && !isTradingDay(previous.weekday);

    for (const [index, bell] of schedule.entries()) {
      const at = etWallClockToInstant(
        date.year,
        date.month,
        date.day,
        bell.hourEt,
        bell.minuteEt,
      );
      if (at.getTime() <= now.getTime()) continue;
      found.push({
        ...bell,
        at,
        carriesWeekend: afterClosedDay && index === 0,
      });
      if (found.length === count) break;
    }
  }

  return found;
}

/**
 * Legacy weekend-carry detector. Always false while BELLS_24_7 is on, because
 * Robinhood Chain never sleeps and there is no dark board.
 */
export function isWeekendCarry(now: Date): boolean {
  if (BELLS_24_7) return false;
  const parts = etParts(now);
  if (!isTradingDay(parts.weekday)) return true;
  const minutes = parts.hour * 60 + parts.minute;
  if (parts.weekday === 5 && minutes >= 16 * 60) return true;
  return false;
}

export function nextBell(
  now: Date,
  includeLunch = INCLUDE_LUNCH_BELL,
): BellOccurrence | null {
  return upcomingBells(now, 1, includeLunch)[0] ?? null;
}

/**
 * True between the Open Bell and the Close Bell.
 * Under BELLS_24_7 this includes weekends; otherwise trading days only.
 */
export function isSessionLive(now: Date): boolean {
  const parts = etParts(now);
  if (!BELLS_24_7 && !isTradingDay(parts.weekday)) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** The upcoming weekly After Hours snapshot: Friday 16:00 ET. */
export function nextWeeklySnapshot(now: Date): Date {
  const parts = etParts(now);
  for (let offset = 0; offset < 8; offset += 1) {
    const date = addDaysToEtDate(parts, offset);
    if (date.weekday !== 5) continue;
    const at = etWallClockToInstant(date.year, date.month, date.day, 16, 0);
    if (at.getTime() > now.getTime()) return at;
  }
  return etWallClockToInstant(parts.year, parts.month, parts.day + 7, 16, 0);
}

export function remainingUntil(target: Date, now: Date): Remaining {
  const totalMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

export const BELL_LABEL: Record<BellKind, string> = {
  open: "Open Bell",
  lunch: "Lunch Bell",
  close: "Close Bell",
};

export function formatCountdownClock(remaining: Remaining | null): string {
  if (!remaining) return "--:--:--";
  const hours = remaining.days * 24 + remaining.hours;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;
}
