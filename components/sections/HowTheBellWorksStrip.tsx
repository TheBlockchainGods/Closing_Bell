"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

import { Reveal } from "@/components/ui/Reveal";
import { EASE_BELL } from "@/lib/motion";

const STEPS = ["Buy", "Tickets", "Pot", "Ring"] as const;

function BrassArrow({ pulse }: { pulse: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="inline-flex text-tape"
      animate={pulse ? { opacity: [0.35, 1, 0.35], x: [0, 3, 0] } : undefined}
      transition={
        pulse
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <svg viewBox="0 0 24 12" className="h-2.5 w-5" fill="none">
        <path
          d="M1 6h18M14 2l5 4-5 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.span>
  );
}

/**
 * Infographic strip between Hero and Bell Pot.
 * Lore kicker + diagram. Community links live in header/footer only.
 */
export function HowTheBellWorksStrip() {
  const reduceMotion = useReducedMotion();
  const pulse = !reduceMotion;

  return (
    <section
      id="how-the-bell-works"
      aria-label="How the bell works"
      className="relative scroll-mt-16 border-t border-line"
    >
      <div className="mx-auto w-full max-w-[1100px] px-5 py-7 sm:px-8 sm:py-9">
        <Reveal>
          <p className="eyebrow text-center">How it works</p>
          <p className="mx-auto mt-3 max-w-xl text-center text-[1.02rem] font-medium leading-snug text-brass-200 sm:text-[1.08rem]">
            Wall Street had one closing bell. Robinhood Chain gives you three.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-5">
          <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2 sm:gap-3">
                <motion.span
                  className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-8% 0px" }}
                  transition={{
                    duration: 0.55,
                    ease: EASE_BELL,
                    delay: 0.1 + index * 0.08,
                  }}
                >
                  {step}
                </motion.span>
                {index < STEPS.length - 1 ? <BrassArrow pulse={pulse} /> : null}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.14} className="mt-5">
          <div className="overflow-hidden rounded-sm border border-line bg-floor-950/40">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0.85, scale: 0.992 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-6% 0px" }}
              transition={{ duration: 0.8, ease: EASE_BELL }}
            >
              <Image
                src="/brand/how-the-bell-works.jpg"
                alt="How Closing Bell works: buy BELL with GME, earn tickets, fees fill the pot, three jackpot rings a day"
                width={1024}
                height={576}
                sizes="(max-width: 1100px) 100vw, 1100px"
                className="mx-auto h-auto w-full max-w-full"
                priority={false}
              />
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
