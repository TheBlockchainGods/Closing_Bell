"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_NAV } from "@/lib/docs-nav";
import { cn } from "@/lib/cn";

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-0.5">
      {DOCS_NAV.map((item) => {
        const active =
          item.href === "/docs"
            ? pathname === "/docs"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xs px-3 py-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] transition-colors",
              active
                ? "bg-tape/12 text-tape"
                : "text-ink-3 hover:bg-floor-900 hover:text-brass-200",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/verify"
        className="mt-3 rounded-xs border border-line px-3 py-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-brass-300 transition-colors hover:border-tape/50 hover:text-tape"
      >
        Open /verify
      </Link>
    </nav>
  );
}
