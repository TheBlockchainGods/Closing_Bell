"use client";

import { CommunityLinks } from "@/components/brand/CommunityLinks";
import { Wordmark } from "@/components/brand/Wordmark";
import { LaunchChrome } from "@/components/LaunchChrome";

const SECTIONS = [
  { href: "#bell-pot", label: "Bell Pot" },
  { href: "#countdown", label: "Countdown" },
  { href: "#odds", label: "Your odds" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#after-hours", label: "After Hours" },
  { href: "#winners", label: "Recent winners" },
  { href: "/docs", label: "Docs" },
  { href: "/verify", label: "Verify" },
];

const RULES = [
  "However you buy, you earn tickets. Per-wallet odds are capped at 10% at launch.",
  "Selling burns Bell tickets pro-rata, immediately.",
  "At the bell, the winner is paid the full pot in GME and every Bell ticket wipes.",
  "Bells ring every day at 09:30 / 12:30 / 16:00 ET. Robinhood Chain never sleeps.",
  "After Hours is next: weekly GME pot for $BELL stakers.",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-floor-1000">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-sm text-[0.92rem] leading-relaxed text-ink-2">
              A market ritual on the GME pair. The pot builds all day, and the
              bell decides who takes it.
            </p>
            <CommunityLinks className="mt-6" />
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="eyebrow">Launch</h2>
              <LaunchChrome className="mt-4" density="stack" />
            </div>
            <a
              href="#top"
              className="mt-6 inline-flex items-center gap-2 rounded-xs font-mono text-[0.63rem] font-medium uppercase tracking-[0.2em] text-brass-400 transition-colors hover:text-tape"
            >
              <span aria-hidden="true">&#8593;</span>
              Back to the top
            </a>
          </div>

          <nav aria-label="Page sections">
            <h2 className="eyebrow">On this page</h2>
            <ul className="mt-5 flex flex-col gap-2.5">
              {SECTIONS.map((section) => (
                <li key={section.href}>
                  <a
                    href={section.href}
                    className="rounded-xs text-[0.92rem] text-ink-2 transition-colors hover:text-tape"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">The rules, short</h2>
            <ul className="mt-5 flex flex-col gap-3">
              {RULES.map((rule) => (
                <li
                  key={rule}
                  className="flex gap-3 text-[0.86rem] leading-relaxed text-ink-2"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-px w-3.5 shrink-0 bg-brass-600"
                  />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-line pt-8">
          <h2 className="label-mono">Disclosures</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 text-[0.8rem] leading-relaxed text-ink-3 sm:grid-cols-2">
            <p>
              Closing Bell is not affiliated with Robinhood Markets, Inc. or any
              exchange. The bell schedule is ritual timing on-chain, not a
              brokerage product.
            </p>
            <p>
              $BELL is a token. It is not GameStop (GME) equity and carries no
              shareholder rights.
            </p>
          </div>
          <p className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            Closing Bell &#183; $BELL &#183; Pair GME
          </p>
        </div>
      </div>
    </footer>
  );
}
