import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function DocsH1({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display type-expanded text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-ink">
      {children}
    </h1>
  );
}

export function DocsLead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-2">
      {children}
    </p>
  );
}

export function DocsH2({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-24 border-t border-line pt-8 font-display text-[1.25rem] font-bold text-brass-100"
    >
      {children}
    </h2>
  );
}

export function DocsP({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-2">
      {children}
    </p>
  );
}

export function DocsUl({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed text-ink-2">
      {children}
    </ul>
  );
}

export function DocsOl({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-3 max-w-2xl list-decimal space-y-2 pl-5 text-[0.95rem] leading-relaxed text-ink-2">
      {children}
    </ol>
  );
}

export function DocsCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs border border-line bg-floor-900 px-1.5 py-0.5 font-mono text-[0.8em] text-brass-200">
      {children}
    </code>
  );
}

export function DocsPre({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-sm border border-line bg-floor-950 px-4 py-4 font-mono text-[0.78rem] leading-relaxed text-brass-100">
      {children}
    </pre>
  );
}

export function DocsCallout({
  title,
  children,
  tone = "note",
}: {
  title: string;
  children: ReactNode;
  tone?: "note" | "warn";
}) {
  return (
    <aside
      className={cn(
        "mt-6 rounded-sm border px-4 py-3",
        tone === "warn"
          ? "border-ember-500/40 bg-ember-500/8"
          : "border-tape/35 bg-tape/8",
      )}
    >
      <p
        className={cn(
          "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em]",
          tone === "warn" ? "text-ember-300" : "text-tape",
        )}
      >
        {title}
      </p>
      <div className="mt-2 text-[0.9rem] leading-relaxed text-ink-2">
        {children}
      </div>
    </aside>
  );
}

export function DocsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-sm border border-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.88rem]">
        <thead className="bg-floor-900">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-line px-4 py-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-brass-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 align-top leading-relaxed text-ink-2"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocsPager({
  prev,
  next,
}: {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <nav
      aria-label="Docs pagination"
      className="mt-14 flex flex-wrap items-stretch justify-between gap-3 border-t border-line pt-8"
    >
      {prev ? (
        <a
          href={prev.href}
          className="min-w-[10rem] flex-1 rounded-sm border border-line bg-floor-900 px-4 py-3 transition-colors hover:border-tape/50 hover:text-tape"
        >
          <span className="block font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink-3">
            Previous
          </span>
          <span className="mt-1 block text-[0.92rem] font-medium text-ink">
            {prev.label}
          </span>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a
          href={next.href}
          className="min-w-[10rem] flex-1 rounded-sm border border-line bg-floor-900 px-4 py-3 text-right transition-colors hover:border-tape/50 hover:text-tape"
        >
          <span className="block font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink-3">
            Next
          </span>
          <span className="mt-1 block text-[0.92rem] font-medium text-ink">
            {next.label}
          </span>
        </a>
      ) : null}
    </nav>
  );
}
