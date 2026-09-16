import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = {
  title: "Docs · Closing Bell ($BELL)",
  description:
    "Short rules for Closing Bell tickets, odds, and how to verify a ring.",
};

const RULES = [
  {
    title: "Earn tickets by buying",
    body: "Any on-chain buy of $BELL on the GME pair mints Bell tickets for the open window, weighted by GME spent. However you buy, the same rules apply.",
  },
  {
    title: "Odds cap at 10%",
    body: "Per-wallet odds are capped at 10% at launch so one wallet cannot own the bell. Extra spend still buys $BELL; it does not buy more odds.",
  },
  {
    title: "Selling burns tickets",
    body: "Sell pro-rata and tickets burn in the same transaction. Conviction is the entry fee.",
  },
  {
    title: "The bell settles everything",
    body: "At 09:30 / 12:30 / 16:00 ET every day, one ticket is drawn, the pot pays out in GME, and every ticket wipes.",
  },
  {
    title: "After Hours is next",
    body: "Weekly staking for a GME pot sits on the roadmap behind a clean Bell Pot run. Stake controls stay off until that ships.",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-dvh bg-floor-1000 text-ink">
      <header className="border-b border-line bg-floor-950/90">
        <div className="mx-auto flex h-16 w-full max-w-[840px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="rounded-xs transition-opacity hover:opacity-80">
            <Wordmark withTicker={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ButtonLink href="/verify" variant="ghost" size="sm">
              Verify
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">
              Back to site
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[840px] px-5 py-14 sm:px-8 sm:py-20">
        <p className="eyebrow">Docs</p>
        <h1 className="mt-4 font-display type-expanded text-[clamp(2.4rem,8vw,3.6rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em]">
          Closing Bell, <span className="brass-text">short form</span>
        </h1>
        <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink-2">
          The locked rules that define the ritual. Recompute any published ring
          on the verify page.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/verify" variant="primary" size="sm">
            Verify a ring
          </ButtonLink>
          <ButtonLink href="#how-tickets-work" variant="secondary" size="sm">
            How tickets work
          </ButtonLink>
        </div>

        <ol
          id="how-tickets-work"
          className="mt-12 flex flex-col gap-8 border-t border-line pt-10"
        >
          {RULES.map((rule, index) => (
            <li key={rule.title} className="flex gap-5">
              <span className="font-display text-[1.4rem] font-extrabold tabular-nums text-brass-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="font-display text-[1.15rem] font-bold text-brass-100">
                  {rule.title}
                </h2>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
                  {rule.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
