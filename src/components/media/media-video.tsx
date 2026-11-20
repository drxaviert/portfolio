"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { VideoMedia } from "@/lib/media-types";
import { useReducedMotion } from "@/components/home/use-reduced-motion";

/**
 * A looping clip that costs nothing while it is off screen, or an adaptive
 * stream that the reader starts themselves.
 *
 * A short loop: the observer plays it as it enters and pauses it on the way out;
 * a hidden tab counts as out. Under `prefers-reduced-motion: reduce` it never
 * starts itself: the poster stays up and a real 44px button, with a visible
 * focus ring, is the only way in.
 *
 * A clip with an `hls` ladder is a different contract. It never autoplays and
 * never loops, it keeps native controls (keyboard reachable, no custom motion),
 * and the library is fetched only once the frame is near the viewport. Safari
 * and iOS take the native HLS path; everyone else gets hls.js over MSE, and a
 * browser with neither keeps the progressive MP4 source.
 *
 * `preload="none"` keeps the bytes for a clip the reader has not scrolled to.
 */
export function MediaVideo({
  media,
  alt,
  className = "",
}: {
  media: VideoMedia;
  alt: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  const hlsUrl = media.hls?.url;
  const streaming = Boolean(hlsUrl);

  useEffect(() => {
    if (streaming) return;
    const video = videoRef.current;
    if (!video) return;

    let onScreen = false;
    let visible = !document.hidden;

    const sync = () => {
      if (onScreen && visible && !reduce) {
        void video.play().catch(() => {
          // A browser that refuses autoplay keeps the poster, which is the
          // same still the reduced-motion path shows.
        });
        return;
      }

      video.pause();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    );

    observer.observe(video);

    const onVisibilityChange = () => {
      visible = !document.hidden;
      sync();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reduce, streaming]);

  useEffect(() => {
    if (!hlsUrl) return;
    const video = videoRef.current;
    if (!video) return;

    let hls: { destroy: () => void } | null = null;
    let started = false;
    let cancelled = false;

    const attach = async () => {
      if (started || cancelled) return;
      started = true;

      // The order hls.js recommends: its own path first, native second, the mp4
      // <source> last. `canPlayType` is not a reliable native test — Safari
      // reports "maybe" and Chrome reports "maybe" for HLS it cannot demux — so
      // it only gets a say when there is no MediaSource to use.
      //
      // hls.js has to be imported to ask `Hls.isSupported()`, so probe the
      // capability it depends on first: no MSE and no ManagedMediaSource means
      // the library cannot work and the bytes are not worth fetching.
      const hasMediaSource =
        typeof MediaSource !== "undefined" ||
        "ManagedMediaSource" in window;
      const nativeHls =
        video.canPlayType("application/vnd.apple.mpegurl") !== "";

      if (hasMediaSource) {
        // hls.js ships no .d.mts beside the light build; the full build's types
        // describe the same API, so cast to them rather than to `any`.
        const light = (await import(
          // @ts-expect-error TS7016: the light build has no declaration file.
          "hls.js/dist/hls.light.mjs"
        )) as typeof import("hls.js");
        const Hls = light.default;
        if (cancelled) return;

        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(hlsUrl);
          instance.attachMedia(video);
          hls = instance;
          return;
        }
      }

      // Older iOS: the element plays HLS itself. Everything else keeps the mp4.
      if (nativeHls) video.src = hlsUrl;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        void attach();
      },
      { threshold: 0.25 },
    );

    observer.observe(video);

    return () => {
      cancelled = true;
      observer.disconnect();
      hls?.destroy();
    };
  }, [hlsUrl]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  return (
    <div
      className={["media", className].filter(Boolean).join(" ")}
      data-media-kind="video"
      style={
        {
          "--media-aspect": `${media.width} / ${media.height}`,
        } as CSSProperties
      }
    >
      <video
        ref={videoRef}
        className="media-asset"
        width={media.width}
        height={media.height}
        poster={media.poster.jpg}
        muted={streaming ? !media.hasAudio : true}
        loop={!streaming}
        playsInline
        preload="none"
        controls={streaming}
        aria-label={alt || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        {media.webm ? <source src={media.webm.url} type="video/webm" /> : null}
        <source src={media.mp4.url} type="video/mp4" />
      </video>

      {reduce && !streaming ? (
        <button
          type="button"
          className="media-play"
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={toggle}
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            {playing ? (
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
            ) : (
              <path d="M6 4.2v11.6L16 10z" />
            )}
          </svg>
        </button>
      ) : null}
    </div>
  );
}
