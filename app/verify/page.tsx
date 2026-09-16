import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { DryRunBanner } from "@/components/DryRunBanner";
import { ButtonLink } from "@/components/ui/Button";
import { VerifyClient } from "@/components/verify/VerifyClient";
import { publicApiBase } from "@/lib/api-base";

export const metadata = {
  title: "Verify a ring · Closing Bell ($BELL)",
  description:
    "Same ticket bag + same public formula → same winner. Check a Closing Bell ring in one tap.",
};

export default function VerifyPage() {
  const apiBase = publicApiBase();

  return (
    <div className="min-h-dvh bg-floor-1000 text-ink">
      <DryRunBanner />
      <header className="border-b border-line bg-floor-950/90">
        <div className="mx-auto flex h-16 w-full max-w-[840px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            className="rounded-xs transition-opacity hover:opacity-80"
          >
            <Wordmark withTicker={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ButtonLink href="/docs" variant="ghost" size="sm">
              Docs
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">
              Back to site
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[840px] px-5 py-14 sm:px-8 sm:py-20">
        <p className="eyebrow">Verify</p>
        <h1 className="mt-4 font-display type-expanded text-[clamp(2.4rem,8vw,3.6rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em]">
          Verify a <span className="brass-text">ring</span>
        </h1>
        <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink-2">
          Same ticket bag + same public formula → same winner. Check it in one
          tap.
        </p>

        <div className="mt-10">
          <VerifyClient apiBase={apiBase} />
        </div>
      </main>
    </div>
  );
}
