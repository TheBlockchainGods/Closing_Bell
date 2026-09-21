"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  DEFINED_URL,
  DEXSCREENER_URL,
  PONS_LAUNCH_URL,
  TOKEN_ADDRESS,
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

export function ContractCopyRow({
  className,
  showTradeLinks = true,
}: {
  className?: string;
  showTradeLinks?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await copyText(TOKEN_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-brass-500">
          Contract
        </span>
        <code
          className="min-w-0 max-w-full break-all rounded-xs border border-line bg-floor-900 px-2.5 py-1.5 font-mono text-[0.72rem] leading-snug tracking-[0.02em] text-ink"
          title={TOKEN_ADDRESS}
        >
          {TOKEN_ADDRESS}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCopy}
          title="Copy contract address"
          aria-label="Copy contract address"
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {showTradeLinks ? (
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={PONS_LAUNCH_URL}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer noopener"
            title="Open $BELL on PONS"
          >
            PONS
          </ButtonLink>
          <ButtonLink
            href={DEFINED_URL}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer noopener"
            title="Open chart on Defined"
          >
            Defined
          </ButtonLink>
          <ButtonLink
            href={DEXSCREENER_URL}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer noopener"
            title="Open chart on DexScreener"
          >
            DexScreener
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
