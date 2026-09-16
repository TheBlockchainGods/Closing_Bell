"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  CA_PLACEHOLDER,
  CHART_URL,
  TOKEN_ADDRESS,
  truncateAddress,
} from "@/lib/launch";

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

export function LaunchChrome({
  className,
  density = "bar",
}: {
  className?: string;
  density?: "bar" | "stack";
}) {
  const [copied, setCopied] = useState(false);
  const live = Boolean(TOKEN_ADDRESS);
  const chartLive = Boolean(CHART_URL);

  const onCopy = async () => {
    if (!TOKEN_ADDRESS) return;
    try {
      await copyText(TOKEN_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn(
        density === "bar"
          ? "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          : "flex flex-col gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-brass-500">
          Contract
        </span>
        <code
          className={cn(
            "min-w-0 truncate rounded-xs border border-line bg-floor-900 px-2.5 py-1.5 font-mono text-[0.72rem] tabular-nums tracking-[0.04em]",
            live ? "text-ink" : "text-ink-3",
          )}
          title={TOKEN_ADDRESS ?? CA_PLACEHOLDER}
        >
          {live ? truncateAddress(TOKEN_ADDRESS!) : CA_PLACEHOLDER}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCopy}
          disabled={!live}
          title={
            live
              ? "Copy contract address"
              : "Contract address posts at launch"
          }
          aria-label={live ? "Copy contract address" : "Contract address not live yet"}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chartLive ? (
          <ButtonLink
            href={CHART_URL!}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer noopener"
            title="Open chart on DexScreener"
          >
            Chart
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Chart link posts at launch"
          >
            Chart
          </Button>
        )}
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
