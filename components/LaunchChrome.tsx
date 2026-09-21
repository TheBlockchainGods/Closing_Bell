"use client";

import { ButtonLink } from "@/components/ui/Button";
import { ContractCopyRow } from "@/components/ContractCopyRow";
import { cn } from "@/lib/cn";

export function LaunchChrome({
  className,
  density = "bar",
}: {
  className?: string;
  density?: "bar" | "stack";
}) {
  return (
    <div
      className={cn(
        density === "bar"
          ? "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          : "flex flex-col gap-3",
        className,
      )}
    >
      <ContractCopyRow />
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/docs" variant="secondary" size="sm" title="Read the docs">
          Docs
        </ButtonLink>
        <ButtonLink
          href="/verify"
          variant="secondary"
          size="sm"
          title="Verify a ring"
        >
          Verify
        </ButtonLink>
      </div>
    </div>
  );
}
