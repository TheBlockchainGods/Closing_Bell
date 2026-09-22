"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button, ButtonLink } from "@/components/ui/Button";
import { copyBlob, copyText, downloadBlob } from "@/lib/clipboard";
import {
  renderJackpotSharePng,
  type JackpotCardAmounts,
} from "@/lib/jackpot-card-image";
import {
  canUseNativeShareNow,
  formatJackpotShareText,
  JACKPOT_SHARE_LINK,
  SHARE_CAPTION_MAX,
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
  totalPaidOutGme: number;
  totalPaidOutUsd: number;
};

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string; blob: Blob }
  | { status: "error" };

const PNG_NAME = "closing-bell-jackpot.png";

export function ShareJackpotModal({
  open,
  onClose,
  displayPotGme,
  displayPotUsd,
  inPotGme,
  accruingGme,
  totalPaidOutGme,
  totalPaidOutUsd,
}: ShareJackpotModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloadState, setDownloadState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [nativeShareOk] = useState(() => canUseNativeShareNow());
  const [xShareNote, setXShareNote] = useState<string | null>(null);

  const amounts: JackpotCardAmounts = {
    displayPotGme,
    displayPotUsd,
    inPotGme,
    accruingGme,
    totalPaidOutGme,
    totalPaidOutUsd,
  };

  const shareText = formatJackpotShareText({
    jackpotGme: displayPotGme,
    jackpotUsd: displayPotUsd,
    paidOutGme: totalPaidOutGme,
    paidOutUsd: totalPaidOutUsd,
  });
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await renderJackpotSharePng(amounts);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ status: "ready", url: objectUrl, blob });
      } catch {
        if (!cancelled) setPreview({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Parent remounts modal per open session; pot fields refresh the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, displayPotGme, displayPotUsd, inPotGme, accruingGme, totalPaidOutGme, totalPaidOutUsd]);

  async function copyLink() {
    try {
      await copyText(JACKPOT_SHARE_LINK);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setCopiedLink(false);
    }
  }

  async function copyCaption() {
    try {
      await copyText(shareText);
      setCopiedText(true);
      window.setTimeout(() => setCopiedText(false), 1800);
    } catch {
      setCopiedText(false);
    }
  }

  async function ensureBlob(): Promise<Blob> {
    if (preview.status === "ready") return preview.blob;
    return renderJackpotSharePng(amounts);
  }

  async function saveImage(): Promise<boolean> {
    setDownloadState("working");
    try {
      const blob = await ensureBlob();
      downloadBlob(blob, PNG_NAME);
      setDownloadState("done");
      window.setTimeout(() => setDownloadState("idle"), 2200);
      return true;
    } catch {
      setDownloadState("error");
      return false;
    }
  }

  async function copyImage() {
    try {
      const blob = await ensureBlob();
      await copyBlob(blob);
      setCopiedImage(true);
      window.setTimeout(() => setCopiedImage(false), 1800);
    } catch {
      setCopiedImage(false);
    }
  }

  async function onShareToXClick() {
    const saved = await saveImage();
    setXShareNote(
      saved
        ? "Image saved. Add it to your X post."
        : "X is open with the caption. Download the image to attach it.",
    );
  }

  async function shareFromDevice() {
    if (!nativeShareOk) return;
    try {
      const blob = await ensureBlob();
      const file = new File([blob], PNG_NAME, { type: "image/png" });
      await navigator.share({
        text: shareText,
        url: JACKPOT_SHARE_LINK,
        files: [file],
      });
    } catch (err) {
      if (isAbortError(err)) return;
      try {
        await navigator.share({ text: shareText, url: JACKPOT_SHARE_LINK });
      } catch (retryErr) {
        if (isAbortError(retryErr)) return;
      }
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
            className="relative z-10 max-h-[min(92dvh,52rem)] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-sm border border-line bg-floor-950 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
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
                  Opens X with the live caption. Save the card and attach it
                  to the post.
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

            <div className="border-b border-line px-5 py-4 sm:px-6">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-3">
                Card preview
              </p>
              <div className="mt-3 overflow-hidden rounded-sm border border-line bg-floor-1000">
                {preview.status === "ready" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob preview URL
                  <img
                    src={preview.url}
                    alt="Closing Bell jackpot share card"
                    className="mx-auto h-auto w-full max-w-full"
                    width={1280}
                    height={720}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center px-4">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-3">
                      {preview.status === "error"
                        ? "Preview failed"
                        : "Building card"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5 px-5 py-5 sm:px-6">
              <ButtonLink
                href={xHref}
                variant="secondary"
                className="w-full justify-between"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void onShareToXClick()}
              >
                <span>Share to X</span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  caption
                </span>
              </ButtonLink>

              <ButtonLink
                href={tgHref}
                variant="secondary"
                className="w-full justify-between"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Share to Telegram</span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  caption
                </span>
              </ButtonLink>

              {nativeShareOk ? (
                <Button
                  variant="secondary"
                  className="w-full justify-between"
                  onClick={() => void shareFromDevice()}
                >
                  <span>Share from this device</span>
                  <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                    phone
                  </span>
                </Button>
              ) : null}

              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={copyLink}
              >
                <span>{copiedLink ? "Link copied" : "Copy link"}</span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  #bell-pot
                </span>
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={() => void saveImage()}
                disabled={downloadState === "working"}
              >
                <span>
                  {downloadState === "working"
                    ? "Saving image"
                    : downloadState === "done"
                      ? "Image saved"
                      : downloadState === "error"
                        ? "Save failed"
                        : "Download image"}
                </span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  PNG
                </span>
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={() => void copyImage()}
              >
                <span>{copiedImage ? "Image copied" : "Copy image"}</span>
                <span className="font-mono text-[0.58rem] normal-case tracking-normal text-ink-3">
                  clipboard
                </span>
              </Button>

              {xShareNote ? (
                <p className="text-[0.8rem] leading-relaxed text-ink-3" role="status">
                  {xShareNote}
                </p>
              ) : (
                <p className="text-[0.8rem] leading-relaxed text-ink-3">
                  Share to X opens the post composer with the live caption. X
                  cannot attach a file from this site, so the card PNG is saved
                  for you to add.
                </p>
              )}
            </div>

            <div className="border-t border-line bg-floor-900/60 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-3">
                  Share caption
                </p>
                <p className="font-mono text-[0.58rem] tabular-nums text-ink-3">
                  {shareText.length}/{SHARE_CAPTION_MAX}
                </p>
              </div>
              <p
                className={cn(
                  "mt-2 whitespace-pre-wrap text-[0.86rem] leading-relaxed text-ink-2",
                )}
              >
                {shareText}
              </p>
              <Button
                variant="tape"
                size="sm"
                className="mt-3 w-full"
                onClick={() => void copyCaption()}
              >
                {copiedText ? "Caption copied" : "Copy text"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === "AbortError"
  );
}
