import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";

interface SectionProps {
  id: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Section({
  id,
  index,
  eyebrow,
  title,
  lead,
  aside,
  children,
  className,
  contentClassName,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("relative scroll-mt-16 border-t border-line", className)}
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex gap-5 sm:gap-8">
              <span
                aria-hidden="true"
                className="mt-1.5 font-mono text-[0.7rem] font-semibold leading-none tracking-[0.18em] text-brass-500"
              >
                {index}
              </span>
              <div className="max-w-2xl">
                <p className="eyebrow">{eyebrow}</p>
                <h2 className="mt-3 font-display type-expanded text-[clamp(2rem,4.4vw,3.1rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.015em] text-ink">
                  {title}
                </h2>
                {lead ? (
                  <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink-2">
                    {lead}
                  </p>
                ) : null}
              </div>
            </div>
            {aside ? <div className="shrink-0">{aside}</div> : null}
          </div>
        </Reveal>

        <div className={cn("mt-12 sm:mt-16", contentClassName)}>{children}</div>
      </div>
    </section>
  );
}
