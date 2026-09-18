"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

/** Self-hosted NYSE closing-bell clip (same source as former YT qxHmvXrc4Zk). */
export const HERO_VIDEO_SRC = "/hero/closing-bell-hero.mp4";
export const HERO_POSTER_SRC = "/hero/closing-bell-hero.jpg";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * Hero BG stays muted until a user gesture (Ring the Bell) enables sound.
 * Mute toggle can turn it back off afterward.
 */
export function useHeroClip() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const muted = !soundOn;
  const staticFallback = Boolean(reduceMotion || mediaFailed);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || staticFallback) return;
    video.muted = muted;
    if (!muted) {
      video.volume = 0.42;
    }
    const play = video.play();
    if (play) {
      void play.catch(() => {
        /* Autoplay can still fail if the browser blocks it; poster remains. */
      });
    }
  }, [muted, staticFallback]);

  const enableSound = () => {
    setSoundOn(true);
  };

  const toggleMute = () => {
    setSoundOn((prev) => !prev);
  };

  return {
    videoRef,
    muted,
    soundOn,
    enableSound,
    toggleMute,
    staticFallback,
    setMediaFailed,
  };
}

export function HeroBackdrop({
  clip,
  className,
}: {
  clip: ReturnType<typeof useHeroClip>;
  className?: string;
}) {
  const { videoRef, staticFallback, setMediaFailed, muted } = clip;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden bg-floor-1000",
        className,
      )}
    >
      {staticFallback ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${HERO_POSTER_SRC})`,
          }}
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER_SRC}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          onError={() => setMediaFailed(true)}
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,11,11,0.42) 0%, rgba(11,11,11,0.58) 42%, rgba(11,11,11,0.92) 100%), radial-gradient(70% 55% at 28% 40%, rgba(11,11,11,0.18) 0%, rgba(11,11,11,0.72) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
    </div>
  );
}

export function HeroMuteControl({
  clip,
}: {
  clip: ReturnType<typeof useHeroClip>;
}) {
  if (clip.staticFallback) return null;
  return (
    <button
      type="button"
      onClick={clip.toggleMute}
      className="rounded-xs border border-line-strong bg-floor-950/80 px-2.5 py-1.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:border-tape/60 hover:text-tape"
      aria-label={clip.muted ? "Unmute hero video" : "Mute hero video"}
      title={
        clip.muted
          ? "Sound off. Ring the Bell also turns sound on."
          : "Sound on"
      }
    >
      {clip.muted ? "Sound off" : "Sound on"}
    </button>
  );
}
