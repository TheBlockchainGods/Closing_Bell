"use client";

import { BoardGroup, BoardSeparator } from "@/components/ui/BoardDigits";
import { Section } from "@/components/ui/Section";
import { BELLS_24_7, BELL_SCHEDULE } from "@/lib/market-clock";
import { cn } from "@/lib/cn";
import { formatEtWeekday, pad2 } from "@/lib/format";
import { useBellClock, useNow } from "@/lib/use-clock";

const etClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function ExchangeClock() {
  const now = useNow();

  return (
    <span className="inline-flex items-center gap-2.5 rounded-xs border border-line bg-floor-900 px-3.5 py-2.5">
      <span className="label-mono">Exchange time</span>
      <span className="font-mono text-[0.8rem] font-semibold tabular-nums text-brass-200">
        {now ? etClock.format(now) : "--:--:--"} ET
      </span>
    </span>
  );
}

export function Countdown() {
  const clock = useBellClock(4);
  const next = clock.next;
  const remaining = clock.remaining;
  const showDays = (remaining?.days ?? 0) > 0;

  return (
    <Section
      id="countdown"
      index="03"
      eyebrow="Countdown"
      title="Next bell on the board"
      lead={
        BELLS_24_7
          ? "Bells ring every calendar day at 09:30, 12:30, and 16:00 ET. Robinhood Chain never sleeps, so Saturday and Sunday hit the same schedule as any weekday."
          : "Bells ring on exchange time on trading days only."
      }
      aside={<ExchangeClock />}
    >
      <div className="panel shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-8">
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="label-mono">Up next</span>
            <span className="font-display type-expanded text-[1.15rem] font-extrabold uppercase tracking-[0.02em] text-brass-200">
              {next ? next.label : "Loading"}
            </span>
          </p>
          <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-ink-3">
            {next
              ? `${formatEtWeekday(next.at)} ${pad2(next.hourEt)}:${pad2(next.minuteEt)} ET`
              : "--:-- ET"}
          </p>
        </div>

        {BELLS_24_7 ? (
          <p className="border-b border-line bg-floor-850 px-5 py-3.5 font-mono text-[0.63rem] font-medium uppercase leading-relaxed tracking-[0.14em] text-tape sm:px-8">
            Live every day. Open, Lunch, and Close keep ringing on weekends too.
          </p>
        ) : null}

        <div className="px-5 py-10 sm:px-8 sm:py-12">
          <div className="flex flex-nowrap items-start justify-center gap-1.5 sm:gap-3">
            {showDays && remaining ? (
              <>
                <BoardGroup
                  value={pad2(remaining.days)}
                  label="Days"
                  size="lg"
                />
                <BoardSeparator />
              </>
            ) : null}
            <BoardGroup
              value={remaining ? pad2(remaining.hours) : "--"}
              label="Hours"
              size="lg"
              dim={!remaining}
            />
            <BoardSeparator dim={!remaining} />
            <BoardGroup
              value={remaining ? pad2(remaining.minutes) : "--"}
              label="Minutes"
              size="lg"
              dim={!remaining}
            />
            <BoardSeparator dim={!remaining} />
            <BoardGroup
              value={remaining ? pad2(remaining.seconds) : "--"}
              label="Seconds"
              size="lg"
              dim={!remaining}
            />
          </div>

          <p className="mx-auto mt-9 max-w-xl text-center text-[0.9rem] leading-relaxed text-ink-2">
            {next
              ? next.note
              : "Reading the schedule for the next ring."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-3">
          {BELL_SCHEDULE.map((bell) => {
            const isNext = next?.kind === bell.kind;
            return (
              <div
                key={bell.kind}
                className={cn(
                  "relative bg-floor-900 px-5 py-6 sm:px-6",
                  isNext && "bg-floor-850",
                )}
              >
                {isNext ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-brass-300),transparent)]"
                  />
                ) : null}
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "font-display type-expanded text-[0.98rem] font-extrabold uppercase tracking-[0.03em]",
                      isNext ? "text-brass-200" : "text-ink",
                    )}
                  >
                    {bell.label}
                  </p>
                  <p
                    className={cn(
                      "font-mono text-[0.78rem] font-semibold tabular-nums",
                      isNext ? "text-brass-300" : "text-ink-3",
                    )}
                  >
                    {pad2(bell.hourEt)}:{pad2(bell.minuteEt)}
                  </p>
                </div>
                <p className="mt-2.5 text-[0.85rem] leading-relaxed text-ink-3">
                  {bell.note}
                </p>
                {isNext ? (
                  <p className="mt-3 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ember-400">
                    Next to ring
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <p className="text-[0.88rem] leading-relaxed text-ink-3">
          {BELLS_24_7
            ? "Three rings a day, every day. Fees keep accruing between them, and each ring pays the pot that built in its window."
            : "Weekends are skipped when the exchange calendar mode is on."}
        </p>
        <p className="text-[0.88rem] leading-relaxed text-ink-3">
          The Lunch Bell is a smaller midday ring on the same rules. It exists
          so a single day is never one all-or-nothing draw.
        </p>
      </div>
    </Section>
  );
}
