import Link from "next/link";
import type { ReactNode } from "react";

import { DocsNav } from "@/components/docs/DocsNav";
import { DryRunBanner } from "@/components/DryRunBanner";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-floor-1000 text-ink">
      <DryRunBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-floor-950/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:h-16 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              className="rounded-xs transition-opacity hover:opacity-80"
              aria-label="Closing Bell home"
            >
              <Wordmark withTicker={false} />
            </Link>
            <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3 sm:inline">
              Docs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/verify" variant="ghost" size="sm">
              Verify
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">
              Site
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-0 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="border-b border-line lg:border-b-0 lg:border-r lg:border-line">
          <div className="px-4 py-5 sm:px-6 lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:py-8">
            <p className="mb-3 px-3 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
              On this site
            </p>
            <DocsNav />
          </div>
        </aside>
        <main className="min-w-0 px-5 py-10 sm:px-8 sm:py-14">{children}</main>
      </div>
    </div>
  );
}
