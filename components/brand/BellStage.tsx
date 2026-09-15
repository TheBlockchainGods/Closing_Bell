"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import type { RingPhase } from "@/lib/bell-store";

/**
 * Static Bellwether still by default. Ring the Bell plays
 * public/brand/bellwether-ring.mp4 all the way to native `ended`, then
 * returns to the still. No fixed timeout hide; no CSS shake.
 */

const STILL = {
  src: "/mascot/bellwether-podium.webp",
  width: 657,
  height: 1015,
};

/** Transparent Grok export. MP4 alpha varies by browser; screen blend cleans black plates. */
const RING_VIDEO = "/brand/bellwether-ring.mp4";

export interface BellStageProps {
  phase: RingPhase;
  /** Bumps on each Ring the Bell click so a new strike can start. */
  ringStartedAt?: number;
  /** True while the gavel clip is playing (button debounce). */
  onPlayingChange?: (playing: boolean) => void;
  /** Fires once when the full clip ends (or fails / reduced-motion skip). */
  onStrikeComplete?: () => void;
  className?: string;
}

export function BellStage({
  ringStartedAt = 0,
  onPlayingChange,
  onStrikeComplete,
  className,
}: BellStageProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastStartedRef = useRef(0);
  const completedRef = useRef(0);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onStrikeCompleteRef = useRef(onStrikeComplete);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange;
    onStrikeCompleteRef.current = onStrikeComplete;
  }, [onPlayingChange, onStrikeComplete]);

  useEffect(() => {
    if (ringStartedAt <= 0) return;
    if (ringStartedAt === lastStartedRef.current) return;
    lastStartedRef.current = ringStartedAt;

    const startedAt = ringStartedAt;
    let cancelled = false;

    const finish = () => {
      if (cancelled || completedRef.current === startedAt) return;
      completedRef.current = startedAt;
      const video = videoRef.current;
      if (video) {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      setPlaying(false);
      onPlayingChangeRef.current?.(false);
      onStrikeCompleteRef.current?.();
    };

    if (reduceMotion) {
      const t = window.setTimeout(finish, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    const video = videoRef.current;
    if (!video) {
      const t = window.setTimeout(finish, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    const onEnded = () => finish();
    const onError = () => finish();
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    const start = window.setTimeout(() => {
      if (cancelled) return;
      setPlaying(true);
      onPlayingChangeRef.current?.(true);
      video.currentTime = 0;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => finish());
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      // Do not pause here: parent remounts / effect re-runs should not cut the clip
      // unless a brand-new strike id arrives (handled by lastStartedRef).
    };
  }, [ringStartedAt, reduceMotion]);

  return (
    <div
      className={cn("relative w-full overflow-visible bg-transparent", className)}
      style={{ aspectRatio: `${STILL.width} / ${STILL.height}` }}
      role="img"
      aria-label={
        playing
          ? "Bellwether striking the gold closing bell with a gavel"
          : "Bellwether raising a gavel over the gold closing bell"
      }
    >
      <Image
        src={STILL.src}
        alt=""
        width={STILL.width}
        height={STILL.height}
        priority
        draggable={false}
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 55vw"
        className={cn(
          "absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-150",
          playing ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      />

      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full bg-transparent object-contain mix-blend-screen transition-opacity duration-150",
          playing ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        src={RING_VIDEO}
        poster={STILL.src}
        muted
        playsInline
        preload="auto"
        aria-hidden={!playing}
      />
    </div>
  );
}
