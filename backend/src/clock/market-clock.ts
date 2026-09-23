export const ET_ZONE = "America/New_York";

export type BellKind = "open" | "lunch" | "close";

export interface BellDefinition {
  kind: BellKind;
  label: string;
  hourEt: number;
  minuteEt: number;
}

export interface BellOccurrence extends BellDefinition {
  at: Date;
  /** True when this is the first ring after a closed day (weekend carry). */
  carriesWeekend: boolean;
}

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export const BELL_SCHEDULE: BellDefinition[] = [
  { kind: "open", label: "Open Bell", hourEt: 9, minuteEt: 30 },
  { kind: "lunch", label: "Lunch Bell", hourEt: 12, minuteEt: 30 },
  { kind: "close", label: "Close Bell", hourEt: 16, minuteEt: 0 },
];

const BELL_KIND_CLOCK_NAME: Record<BellKind, string> = {
  open: "Open",
  lunch: "Lunch",
  close: "Close",
};

/** Public clock copy: Open 9:30 AM ET · Lunch 12:30 PM ET · Close 4:00 PM ET */
export function formatBellClockLine(): string {
  return BELL_SCHEDULE.map((bell) => {
    const hour12 = bell.hourEt % 12 || 12;
    const ampm = bell.hourEt >= 12 ? "PM" : "AM";
    const minute = String(bell.minuteEt).padStart(2, "0");
    return `${BELL_KIND_CLOCK_NAME[bell.kind]} ${hour12}:${minute} ${ampm} ET`;
  }).join(" · ");
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

export interface EtParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export function etParts(instant: Date): EtParts {
  const parts = etPartsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  let hour = Number(read("hour"));
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

/** Convert an ET wall-clock time into an absolute instant (DST-safe). */
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

export function isTradingDay(weekday: number, bells24_7: boolean): boolean {
  if (bells24_7) return true;
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
 * Next `count` bells after `now`.
 * When `bells24_7` is false, Saturdays and Sundays are skipped and the first
 * bell after a closed day is flagged `carriesWeekend`.
 */
export function upcomingBells(
  now: Date,
  count = 3,
  bells24_7 = true,
): BellOccurrence[] {
  const today = etParts(now);
  const found: BellOccurrence[] = [];

  for (let offset = 0; offset < 14 && found.length < count; offset += 1) {
    const date = addDaysToEtDate(today, offset);
    if (!isTradingDay(date.weekday, bells24_7)) continue;

    const previous = addDaysToEtDate(date, -1);
    const afterClosedDay =
      !bells24_7 && !isTradingDay(previous.weekday, bells24_7);

    for (const [index, bell] of BELL_SCHEDULE.entries()) {
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

export function nextBell(now: Date, bells24_7 = true): BellOccurrence | null {
  return upcomingBells(now, 1, bells24_7)[0] ?? null;
}

/**
 * Previous bell at or before `now` (used to bound the current window start).
 */
export function previousBell(now: Date, bells24_7 = true): BellOccurrence | null {
  const today = etParts(now);
  let last: BellOccurrence | null = null;

  for (let offset = -7; offset <= 0; offset += 1) {
    const date = addDaysToEtDate(today, offset);
    if (!isTradingDay(date.weekday, bells24_7)) continue;

    const previous = addDaysToEtDate(date, -1);
    const afterClosedDay =
      !bells24_7 && !isTradingDay(previous.weekday, bells24_7);

    for (const [index, bell] of BELL_SCHEDULE.entries()) {
      const at = etWallClockToInstant(
        date.year,
        date.month,
        date.day,
        bell.hourEt,
        bell.minuteEt,
      );
      if (at.getTime() > now.getTime()) continue;
      last = {
        ...bell,
        at,
        carriesWeekend: afterClosedDay && index === 0,
      };
    }
  }

  return last;
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

/** Instant when the ticket bag freezes for the upcoming bell. */
export function snapshotAtForBell(
  bellAt: Date,
  snapshotLeadSeconds: number,
): Date {
  return new Date(bellAt.getTime() - snapshotLeadSeconds * 1000);
}
