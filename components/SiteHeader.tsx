"use client";

import { useBell } from "@/lib/bell-store";
import { CommunityLinks } from "@/components/brand/CommunityLinks";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { useBellClock } from "@/lib/use-clock";
import { shortAddress } from "@/lib/format";

const NAV = [
  { href: "#bell-pot", label: "Bell Pot" },
  { href: "#countdown", label: "Countdown" },
  { href: "#odds", label: "Your odds" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#after-hours", label: "After Hours" },
];

export function SiteHeader() {
  const bell = useBell();
  const clock = useBellClock(1);

  const status = !clock.ready
    ? "Loading session"
    : clock.sessionLive
      ? "Session live"
      : "Between bells";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-floor-950/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
        <a
          href="#top"
          className="rounded-xs transition-opacity hover:opacity-80"
          aria-label="Closing Bell, back to top"
        >
          <Wordmark />
        </a>

        <nav aria-label="Sections" className="ml-2 hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-xs px-3 py-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-ink-2 transition-colors hover:text-tape"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 md:flex">
            <span
              className={`size-1.5 rounded-full ${
                clock.sessionLive
                  ? "bg-tape shadow-[0_0_10px_rgba(0,200,5,0.9)]"
                  : "bg-brass-600"
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-[0.63rem] font-medium uppercase tracking-[0.16em] text-ink-3">
              {status}
            </span>
          </span>

          <CommunityLinks />

          {bell.watched ? (
            <ButtonLink
              href="#odds"
              variant="secondary"
              size="sm"
              title="Jump to the odds panel for this address"
            >
              <span
                className="size-1.5 rounded-full bg-brass-300"
                aria-hidden="true"
              />
              {shortAddress(bell.watched.address)}
            </ButtonLink>
          ) : (
            <ButtonLink
              href="#odds"
              variant="secondary"
              size="sm"
              title="Read any address's tickets and odds"
            >
              <span className="sm:hidden">Odds</span>
              <span className="hidden sm:inline">Check odds</span>
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
