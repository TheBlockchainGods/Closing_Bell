"use client";

import { AmountInput } from "@/components/ui/AmountInput";
import { BoardGroup } from "@/components/ui/BoardDigits";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useBell } from "@/lib/bell-store";
import {
  formatCompact,
  formatEtStamp,
  formatGme,
  formatPct,
  pad2,
} from "@/lib/format";
import { useWeeklySnapshotClock } from "@/lib/use-clock";

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-xs border border-brass-700/70 bg-brass-500/10 px-3 py-2">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-brass-400"
      />
      <span className="font-mono text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-brass-200">
        Coming soon
      </span>
    </span>
  );
}

function TargetFigure({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <p className="label-mono">{label}</p>
      <p className="mt-1.5 font-display text-[1.15rem] font-bold tabular-nums text-ink-2">
        {value}
        {unit ? (
          <span className="ml-1.5 font-mono text-[0.62rem] text-ink-3">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function AfterHours() {
  const bell = useBell();
  const snapshot = useWeeklySnapshotClock();
  const remaining = snapshot.remaining;

  return (
    <Section
      id="after-hours"
      index="07"
      eyebrow="After Hours"
      title="Hold through Friday. Share the weekly pot."
      lead="Stake $BELL through the Close Bell snapshot and take a cut of a weekly pot paid in GME. The next expansion after the daily ritual is running clean."
      aside={<ComingSoonBadge />}
    >
      <div className="panel shadow-panel overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="border-b border-line px-5 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-r">
            <p className="label-mono">Weekly pot target</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display type-expanded text-[clamp(2.6rem,7vw,4.6rem)] font-extrabold leading-[0.85] tracking-[-0.02em] tabular-nums text-ink-2">
                {formatGme(bell.afterHoursTargetPotGme)}
              </span>
              <span className="mb-1.5 font-mono text-[0.85rem] font-semibold tracking-[0.14em] text-brass-500">
                GME
              </span>
            </div>

            <div className="mt-9">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="label-mono">Snapshot cadence</p>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-brass-500">
                  {snapshot.at ? formatEtStamp(snapshot.at) : "--"}
                </p>
              </div>
              <div className="mt-4 flex gap-5">
                {(
                  [
                    ["days", "Days"],
                    ["hours", "Hrs"],
                    ["minutes", "Min"],
                    ["seconds", "Sec"],
                  ] as const
                ).map(([key, label]) => (
                  <BoardGroup
                    key={key}
                    value={remaining ? pad2(remaining[key]) : "--"}
                    label={label}
                    size="sm"
                    dim
                  />
                ))}
              </div>
              <p className="mt-4 text-[0.85rem] leading-relaxed text-ink-3">
                Friday 16:00 ET, same instant as the Close Bell. Weight is read
                once. Hold through it to count.
              </p>
            </div>

            <div className="mt-9 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-2">
              <TargetFigure
                label="Staked target"
                value={formatCompact(bell.afterHoursTargetStakedBell)}
                unit="BELL"
              />
              <TargetFigure
                label="Of supply"
                value={formatPct(bell.afterHoursTargetStakedShare, 0)}
              />
            </div>
          </div>

          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <p className="font-display type-expanded text-[1.15rem] font-extrabold uppercase tracking-[0.02em] text-ink">
              Your stake
            </p>
            <p className="mt-4 text-[0.9rem] leading-relaxed text-ink-2">
              Stake controls stay off until After Hours ships. The shape below is
              what you will use when it does.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <AmountInput
                id="stake-amount"
                label="Amount to stake"
                value=""
                onChange={() => {}}
                suffix="BELL"
                disabled
                helper="Opens when After Hours ships"
              />

              <Button
                variant="secondary"
                disabled
                title="After Hours is still on the roadmap"
              >
                Stake into After Hours
              </Button>
            </div>

            <dl className="mt-8 border-t border-line pt-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                <dt className="label-mono">Weight read at</dt>
                <dd className="font-mono text-[0.78rem] font-semibold text-ink-2">
                  Friday 16:00 ET
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                <dt className="label-mono">Unstake before it</dt>
                <dd className="font-mono text-[0.78rem] font-semibold text-ink-2">
                  No weight
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="label-mono">Paid in</dt>
                <dd className="font-mono text-[0.78rem] font-semibold text-ink-2">
                  GME
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Section>
  );
}
