"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { VideoMedia } from "@/lib/media-types";
import { useReducedMotion } from "@/components/home/use-reduced-motion";

/**
 * A looping clip that costs nothing while it is off screen.
 *
 * The observer plays it as it enters and pauses it on the way out; a hidden tab
 * counts as out. Under `prefers-reduced-motion: reduce` it never starts itself:
 * the poster stays up and a real 44px button, with a visible focus ring, is the
 * only way in. `preload="none"` keeps the bytes for a clip the reader has not
 * scrolled to yet.
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

  useEffect(() => {
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
  }, [reduce]);

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
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        {media.webm ? <source src={media.webm.url} type="video/webm" /> : null}
        <source src={media.mp4.url} type="video/mp4" />
      </video>

      {reduce ? (
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
