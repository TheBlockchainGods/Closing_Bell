"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

/** NYSE-style closing bell clip. Embed only; never download into the repo. */
export const HERO_YT_ID = "qxHmvXrc4Zk";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

function ytSrc(origin: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: HERO_YT_ID,
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    origin,
  });
  return `https://www.youtube-nocookie.com/embed/${HERO_YT_ID}?${params.toString()}`;
}

function command(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*",
  );
}

function subscribeOrigin() {
  return () => {};
}

/**
 * Hero BG stays muted until a user gesture (Ring the Bell) enables sound.
 * Mute toggle can turn it back off afterward.
 */
export function useHeroClip() {
  const reduceMotion = useReducedMotion();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const origin = useSyncExternalStore(
    subscribeOrigin,
    () => window.location.origin,
    () => "",
  );
  const [soundOn, setSoundOn] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const muted = !soundOn;
  const staticFallback = Boolean(reduceMotion || embedFailed || !origin);

  useEffect(() => {
    if (staticFallback) return;
    if (muted) {
      command(iframeRef.current, "mute");
      return;
    }
    command(iframeRef.current, "unMute");
    command(iframeRef.current, "setVolume", [42]);
    command(iframeRef.current, "playVideo");
  }, [muted, staticFallback]);

  const enableSound = () => {
    setSoundOn(true);
  };

  const toggleMute = () => {
    setSoundOn((prev) => !prev);
  };

  return {
    iframeRef,
    origin,
    muted,
    soundOn,
    enableSound,
    toggleMute,
    staticFallback,
    setEmbedFailed,
  };
}

export function HeroBackdrop({
  clip,
  className,
}: {
  clip: ReturnType<typeof useHeroClip>;
  className?: string;
}) {
  const { iframeRef, origin, staticFallback, setEmbedFailed } = clip;

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
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 70% at 72% 18%, rgba(0,200,5,0.16) 0%, rgba(212,160,23,0.12) 28%, rgba(11,11,11,0) 62%), linear-gradient(180deg, #0b0b0b 0%, #121212 100%)",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {/*
            Contain the 16:9 frame so the full scene is visible (letterbox bars
            match the floor). Avoid the old 140% cover crop.
          */}
          <iframe
            ref={iframeRef}
            title=""
            src={ytSrc(origin)}
            allow="autoplay; encrypted-media"
            className="pointer-events-none aspect-video h-[min(100%,56.25vw)] w-[min(100%,177.78vh)] max-h-full max-w-full border-0"
            onError={() => setEmbedFailed(true)}
            tabIndex={-1}
          />
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,11,11,0.52) 0%, rgba(11,11,11,0.72) 48%, rgba(11,11,11,0.96) 100%), radial-gradient(70% 55% at 28% 40%, rgba(11,11,11,0.22) 0%, rgba(11,11,11,0.82) 100%)",
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
