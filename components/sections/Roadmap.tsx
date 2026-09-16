import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";

const ITEMS: {
  id: string;
  title: string;
  blurb: string;
  next?: boolean;
}[] = [
  {
    id: "after-hours",
    title: "After Hours",
    blurb:
      "Stake $BELL through the Friday Close snapshot and take a cut of a weekly pot paid in GME.",
    next: true,
  },
  {
    id: "alerts",
    title: "Bell alerts",
    blurb:
      "Telegram pings when the pot climbs hard, when your odds move, and when the next bell is minutes out.",
  },
  {
    id: "router-tape",
    title: "Router tape",
    blurb:
      "One ladder that already treats every router the same. Next up: clearer breakdowns by where trades landed, without changing how tickets mint.",
  },
  {
    id: "proof",
    title: "On-chain proof",
    blurb:
      "Live CA, chart, and settlement receipts on the surface the moment the contract is live. No fake links before that.",
  },
];

export function Roadmap() {
  return (
    <Section
      id="roadmap"
      index="06"
      eyebrow="Roadmap"
      title={
        <>
          What ships <span className="brass-text">next</span>
        </>
      }
      lead="The Bell Pot is the ritual. Everything below is the expansion path, written bullish and honest about order."
    >
      <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
        {ITEMS.map((item, index) => (
          <Reveal
            as="li"
            key={item.id}
            delay={index * 0.06}
            className="relative flex flex-col bg-floor-900 px-6 py-8 sm:px-8"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display type-expanded text-[1.35rem] font-extrabold uppercase tracking-[0.02em] text-ink">
                {item.title}
              </h3>
              {item.next ? (
                <span className="inline-flex items-center gap-1.5 rounded-xs border border-brass-600/80 bg-brass-500/12 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-brass-200">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-brass-300"
                  />
                  Next
                </span>
              ) : (
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-3">
                  Queued
                </span>
              )}
            </div>
            <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-2">
              {item.blurb}
            </p>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(204,156,52,0.35),transparent)]"
            />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
