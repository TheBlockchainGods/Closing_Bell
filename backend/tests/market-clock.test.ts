import { describe, expect, it } from "vitest";

import {
  BELL_SCHEDULE,
  etWallClockToInstant,
  formatBellClockLine,
  nextBell,
  snapshotAtForBell,
  upcomingBells,
} from "../src/clock/market-clock.js";

describe("market clock", () => {
  it("schedules Open 9:30, Lunch 12:30, Close 16:00 ET", () => {
    expect(BELL_SCHEDULE.map((bell) => [bell.kind, bell.hourEt, bell.minuteEt])).toEqual(
      [
        ["open", 9, 30],
        ["lunch", 12, 30],
        ["close", 16, 0],
      ],
    );
    expect(formatBellClockLine()).toBe(
      "Open 9:30 AM ET · Lunch 12:30 PM ET · Close 4:00 PM ET",
    );
  });

  it("maps Thursday 17 Sep 2026 bells to EDT instants", () => {
    expect(etWallClockToInstant(2026, 9, 17, 9, 30).toISOString()).toBe(
      "2026-09-17T13:30:00.000Z",
    );
    expect(etWallClockToInstant(2026, 9, 17, 12, 30).toISOString()).toBe(
      "2026-09-17T16:30:00.000Z",
    );
    expect(etWallClockToInstant(2026, 9, 17, 16, 0).toISOString()).toBe(
      "2026-09-17T20:00:00.000Z",
    );
  });

  it("locks the bag SNAPSHOT_LEAD_SECONDS before the ring", () => {
    const close = etWallClockToInstant(2026, 9, 17, 16, 0);
    expect(snapshotAtForBell(close, 120).toISOString()).toBe(
      "2026-09-17T19:58:00.000Z",
    );
  });

  it("returns Lunch, Close, then next Open after a mid-morning instant", () => {
    const now = new Date("2026-09-17T14:00:00.000Z");
    const bells = upcomingBells(now, 3, true);
    expect(bells.map((bell) => bell.kind)).toEqual(["lunch", "close", "open"]);
  });

  it("skips Saturday and Sunday when BELLS_24_7 is false", () => {
    const fridayClose = etWallClockToInstant(2026, 9, 18, 16, 0);
    const now = new Date(fridayClose.getTime() + 1000);
    const next = nextBell(now, false);
    expect(next?.kind).toBe("open");
    expect(next?.carriesWeekend).toBe(true);
    expect(next?.at.toISOString()).toBe("2026-09-21T13:30:00.000Z");
  });
});
