"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button, ButtonLink } from "@/components/ui/Button";
import { downloadJackpotSharePng } from "@/lib/jackpot-card-image";
import {
  formatJackpotShareText,
  JACKPOT_SHARE_LINK,
  telegramShareHref,
  twitterShareHref,
} from "@/lib/jackpot-share";
import { EASE_BELL } from "@/lib/motion";
import { cn } from "@/lib/cn";

type ShareJackpotModalProps = {
  open: boolean;
  onClose: () => void;
  displayPotGme: number;
  displayPotUsd: number;
  inPotGme: number;
  accruingGme: number;
};

export function ShareJackpotModal({
  open,
  onClose,
  displayPotGme,
  displayPotUsd,
  inPotGme,
  accruingGme,
}: ShareJackpotModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloadState, setDownloadState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");

  const shareText = formatJackpotShareText(displayPotGme, displayPotUsd);
  const xHref = twitterShareHref(shareText);
  const tgHref = telegramShareHref(JACKPOT_SHARE_LINK, shareText);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(JACKPOT_SHARE_LINK);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function downloadImage() {
    setDownloadState("working");
    try {
      await downloadJackpotSharePng({
        displayPotGme,
        displayPotUsd,
        inPotGme,
        accruingGme,
      });
      setDownloadState("done");
      window.setTimeout(() => setDownloadState("idle"), 1800);
    } catch {
      setDownloadState("error");
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close share sheet"
            className="absolute inset-0 bg-floor-1000/78 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-sm border border-line bg-floor-950 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE_BELL }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="label-mono text-tape">Share</p>
                <h2
                  id={titleId}
                  className="mt-2 font-display text-[1.35rem] font-bold text-ink"
                >
                  Share the jackpot
                </h2>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-3">
                  Post the live pot, copy the link, or download a card image.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="rounded-xs border border-line bg-floor-900 px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-2 transition-colors hover:border-tape/50 hover:text-tape"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 px-5 py-5 sm:px-6">
              <ButtonLink
                href={xHref}
                target="_blank"
                rel="noreferrer noopener"
                variant="secondary"
                className="w-full justify-between"
              >
                <span>Share to X</span>
                <span aria-hidden="true" className="text-brass-400">
                  &#8599;
                </span>
              </ButtonLink>

              <ButtonLink
                href={tgHref}
                target="_blank"
                rel="noreferrer noopener"
                variant="secondary"
                className="w-full justify-between"
              >
                <span>Share to Telegram</span>
                <span aria-hidden="true" className="text-brass-400">
                  &#8599;
                </span>
              </ButtonLink>

              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={copyLink}
              >
                <span>{copied ? "Link copied" : "Copy link"}</span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  #bell-pot
                </span>
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={downloadImage}
                disabled={downloadState === "working"}
              >
                <span>
                  {downloadState === "working"
                    ? "Building image"
                    : downloadState === "done"
                      ? "Downloaded"
                      : downloadState === "error"
                        ? "Download failed"
                        : "Download image"}
                </span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  PNG
                </span>
              </Button>
            </div>

            <div className="border-t border-line bg-floor-900/60 px-5 py-4 sm:px-6">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-3">
                Prefill
              </p>
              <p
                className={cn(
                  "mt-2 text-[0.86rem] leading-relaxed text-ink-2",
                )}
              >
                {shareText}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
