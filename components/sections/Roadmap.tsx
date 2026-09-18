import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/cn";

type Status = "live" | "next" | "queued";

type Item = {
  id: string;
  title: string;
  blurb: string;
  status: Status;
};

const LIVE: Item[] = [
  {
    id: "core-bell-pot",
    title: "Core Bell Pot",
    blurb:
      "Three daily rings: Open, Lunch, Close. Tickets, odds, /verify, docs, and closingbellonrh.com ship with the ritual.",
    status: "live",
  },
  {
    id: "telegram-bot",
    title: "Telegram + Bellwether bot",
    blurb:
      "/pot, /jackpot, /how, /verify, /fairness and /random (same answer), win celebration pins, and community commands in the channel.",
    status: "live",
  },
  {
    id: "bell-alerts",
    title: "Bell Alerts",
    blurb:
      "Pings when the pot climbs hard, when odds move, and when the next bell is minutes out.",
    status: "live",
  },
  {
    id: "router-tape",
    title: "Router tape",
    blurb:
      "One ladder across routers, with clearer breakdowns by where trades landed. Mint rules stay the same wherever you buy.",
    status: "live",
  },
];

const NEXT: Item[] = [
  {
    id: "after-hours",
    title: "After Hours",
    blurb:
      "Stake $BELL through the Friday Close snapshot and take a cut of a weekly pot paid in GME.",
    status: "next",
  },
  {
    id: "proof",
    title: "On-chain proof",
    blurb:
      "Live CA, chart, and settlement receipts on the surface when the contract is live. No fake links before that.",
    status: "queued",
  },
];

function StatusBadge({ status }: { status: Status }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xs border border-tape/50 bg-tape/10 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-tape">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-tape"
        />
        Live
      </span>
    );
  }
  if (status === "next") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xs border border-brass-600/80 bg-brass-500/12 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-brass-200">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-brass-300"
        />
        Next
      </span>
    );
  }
  return (
    <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-3">
      Queued
    </span>
  );
}

function FeatureCard({
  item,
  delay,
}: {
  item: Item;
  delay: number;
}) {
  return (
    <Reveal
      as="li"
      delay={delay}
      className="relative flex flex-col bg-floor-900 px-6 py-8 sm:px-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display type-expanded text-[1.35rem] font-extrabold uppercase tracking-[0.02em] text-ink">
          {item.title}
        </h3>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-2">
        {item.blurb}
      </p>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          item.status === "live"
            ? "bg-[linear-gradient(90deg,transparent,rgba(0,200,5,0.35),transparent)]"
            : "bg-[linear-gradient(90deg,transparent,rgba(204,156,52,0.35),transparent)]",
        )}
      />
    </Reveal>
  );
}

export function Roadmap() {
  return (
    <Section
      id="roadmap"
      index="06"
      eyebrow="Launch and next"
      title={
        <>
          What&apos;s live, and what&apos;s{" "}
          <span className="brass-text">next</span>
        </>
      }
      lead="Core Bell Pot, site, verify, Telegram, alerts, and router tape shipped at launch. After Hours and on-chain proof are the real roadmap."
    >
      <div className="space-y-10">
        <div>
          <h3 className="eyebrow text-tape">What&apos;s live</h3>
          <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-ink-3">
            Launch features. Already on closingbellonrh.com and in the channel.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            {LIVE.map((item, index) => (
              <FeatureCard key={item.id} item={item} delay={index * 0.05} />
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow text-brass-200">What&apos;s next</h3>
          <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-ink-3">
            The expansion path after the daily ritual is running clean.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            {NEXT.map((item, index) => (
              <FeatureCard
                key={item.id}
                item={item}
                delay={0.12 + index * 0.06}
              />
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
