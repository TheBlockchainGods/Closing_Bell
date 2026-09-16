"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { BellStage } from "@/components/brand/BellStage";
import {
  HeroBackdrop,
  HeroMuteControl,
  useHeroClip,
} from "@/components/brand/HeroBackdrop";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useBell } from "@/lib/bell-store";
import { PONS_URL } from "@/lib/mock-data";
import { EASE_BELL } from "@/lib/motion";
import { useNow } from "@/lib/use-clock";

export function Hero() {
  const bell = useBell();
  const now = useNow();
  const cooldownSec =
    now && bell.ringCooldownUntil > now.getTime()
      ? Math.ceil((bell.ringCooldownUntil - now.getTime()) / 1000)
      : 0;
  const [strikePlaying, setStrikePlaying] = useState(false);
  const ringLocked =
    bell.ringPhase !== "idle" || cooldownSec > 0 || strikePlaying;
  const clip = useHeroClip();

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE_BELL, delay },
  });

  const onRing = () => {
    if (ringLocked) return;
    // User gesture: unmute / start hero audio, then play gavel MP4 + simulated draw.
    clip.enableSound();
    bell.ring();
  };

  return (
    <section id="top" className="relative scroll-mt-16 overflow-hidden">
      <HeroBackdrop clip={clip} />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-14 lg:pt-16">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 lg:col-span-6 lg:pt-2">
            <motion.p className="eyebrow" {...enter(0)}>
              $BELL &nbsp;&#183;&nbsp; GME pair &nbsp;&#183;&nbsp; Robinhood
              Chain
            </motion.p>

            <motion.h1
              className="mt-5 font-display type-expanded text-[clamp(2.8rem,9.5vw,5.2rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.03em]"
              {...enter(0.06)}
            >
              <span className="block text-ink">Closing</span>
              <span className="brass-text block">Bell</span>
            </motion.h1>

            <motion.p
              className="mt-6 max-w-[28rem] text-[1.15rem] font-medium leading-[1.45] text-ink sm:text-[1.22rem]"
              {...enter(0.12)}
            >
              Markets used to live and die by one closing bell a day.
            </motion.p>

            <motion.p
              className="mt-3 max-w-[30rem] text-[0.98rem] leading-[1.55] text-ink-2 sm:text-[1.02rem]"
              {...enter(0.16)}
            >
              On Robinhood Chain, the bell can ring three times (Open, Lunch,
              Close), and one wallet takes the pot. Robinhood Chain never
              sleeps.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              {...enter(0.2)}
            >
              <ButtonLink href="#odds" variant="primary" size="lg">
                Check odds
              </ButtonLink>
              <ButtonLink
                href={PONS_URL}
                variant="secondary"
                size="lg"
                target="_blank"
                rel="noreferrer noopener"
              >
                Trade on PONS
              </ButtonLink>
            </motion.div>

            <motion.p
              className="mt-4 font-mono text-[0.63rem] uppercase tracking-[0.14em] text-ink-3"
              {...enter(0.24)}
            >
              However you buy, you earn tickets.
            </motion.p>
          </div>

          <motion.div
            className="relative min-w-0 lg:col-span-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_BELL, delay: 0.08 }}
          >
            <div className="relative mx-auto w-full max-w-[13.5rem] sm:max-w-[16.5rem] lg:ml-auto lg:mr-0 lg:max-w-[18.5rem]">
              <BellStage
                phase={bell.ringPhase}
                ringStartedAt={bell.ringStartedAt}
                onPlayingChange={setStrikePlaying}
                onStrikeComplete={bell.finishRing}
              />
            </div>

            <div className="mx-auto mt-4 flex w-full max-w-[13.5rem] flex-col items-center gap-3 sm:max-w-[16.5rem] lg:ml-auto lg:mr-0 lg:max-w-[18.5rem]">
              <p className="max-w-[22rem] text-center text-[0.88rem] leading-relaxed text-ink-2">
                Bellwether works the gavel. He hasn&apos;t missed a close yet.
              </p>

              <Button
                variant="signal"
                size="lg"
                onClick={onRing}
                disabled={ringLocked}
                aria-label="Ring the bell: play full gavel strike, unmute hero audio, simulated draw"
                title={
                  strikePlaying || bell.ringPhase !== "idle"
                    ? "The gavel strike is playing"
                    : cooldownSec > 0
                      ? `Cooldown ${cooldownSec}s`
                      : "Plays the full gavel clip, turns on hero sound, runs a simulated ring"
                }
              >
                {strikePlaying || bell.ringPhase !== "idle"
                  ? "Ringing\u2026"
                  : cooldownSec > 0
                    ? `Wait ${cooldownSec}s`
                    : "Ring the Bell"}
              </Button>
              <p className="text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
                Simulated draw. No transaction, no funds move.
              </p>
              <HeroMuteControl clip={clip} />
            </div>
          </motion.div>
        </div>

        <div className="mt-10 flex items-center gap-4 sm:mt-12">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          <a
            href="#how-the-bell-works"
            className="group flex items-center gap-2 rounded-xs font-mono text-[0.63rem] font-medium uppercase tracking-[0.2em] text-ink-3 transition-colors hover:text-tape"
          >
            How it works
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-y-0.5"
            >
              &#8595;
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
