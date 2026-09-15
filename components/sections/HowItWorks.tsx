import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { HOW_STEPS, LOCKED_RULES } from "@/lib/mock-data";

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      index="05"
      eyebrow="How it works"
      title={
        <>
          Buy. Accrue. <span className="brass-text">Ring.</span>
        </>
      }
      lead="Three moves, one ritual, repeated every session. The rules below are fixed in the contract and cannot be tuned per window."
    >
      <ol className="grid grid-cols-1 gap-px bg-line lg:grid-cols-3">
        {HOW_STEPS.map((step, index) => (
          <Reveal
            as="li"
            key={step.index}
            delay={index * 0.08}
            className="relative flex flex-col bg-floor-900 px-6 py-8 sm:px-8 sm:py-10"
          >
            <div className="flex items-center gap-4">
              <span className="font-display type-expanded text-[2.6rem] font-extrabold leading-none text-brass-600 tabular-nums">
                {step.index}
              </span>
              <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
            </div>

            <h3 className="mt-6 font-display type-expanded text-[1.9rem] font-extrabold uppercase leading-none tracking-[-0.01em] text-ink">
              {step.title}
            </h3>
            <p className="mt-2.5 font-mono text-[0.66rem] font-medium uppercase tracking-[0.16em] text-brass-400">
              {step.kicker}
            </p>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-2">
              {step.body}
            </p>

            <p className="mt-auto flex gap-3 pt-7 text-[0.85rem] leading-relaxed text-ink-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-px w-6 shrink-0 bg-brass-600"
              />
              {step.rule}
            </p>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.1}>
        <div className="mt-10 border-t border-line pt-10">
          <h3 className="eyebrow">Locked rules</h3>
          <dl className="mt-6 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
            {LOCKED_RULES.map((rule) => (
              <div key={rule.id}>
                <dt className="font-display text-[1.05rem] font-bold text-brass-200">
                  {rule.title}
                </dt>
                <dd className="mt-2 text-[0.9rem] leading-relaxed text-ink-2">
                  {rule.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </Section>
  );
}
