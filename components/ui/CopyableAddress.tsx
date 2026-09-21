"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { explorerTxUrl } from "@/lib/explorer";

export function CopyableAddress({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await copyText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <code className="min-w-0 max-w-full break-all font-mono text-[0.8rem] leading-snug tracking-[0.01em] text-ink">
        {address}
      </code>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void onCopy()}
        title="Copy wallet address"
        aria-label="Copy wallet address"
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function PayoutTxLink({
  txHash,
  className,
}: {
  txHash: string | null | undefined;
  className?: string;
}) {
  const url = explorerTxUrl(txHash);
  if (!url) return null;
  return (
    <ButtonLink
      href={url}
      variant="ghost"
      size="sm"
      className={className}
      target="_blank"
      rel="noreferrer noopener"
      title="Open payout transaction on Robinhood explorer"
    >
      View on explorer
    </ButtonLink>
  );
}
