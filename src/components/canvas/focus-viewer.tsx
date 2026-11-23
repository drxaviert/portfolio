"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { MediaImage } from "@/components/media/media-image";
import { MediaVideo } from "@/components/media/media-video";
import type { CanvasItem } from "./infinite-canvas";
import { TRANSITION, fitBox } from "./transition";

const FADE_S = 0.12;

const FOCUSABLE =
  'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen media viewer.
 *
 * Opening and closing are cross-fades at the same full-size box the WebGL
 * plane grows to. The canvas keeps a persistent texture/plane underneath; the
 * viewer waits for a decoded frame before fading in and hands the paused video
 * time to the canvas before fading out, so nothing reloads or changes crop.
 */
export function FocusViewer({
  items,
  initialIndex,
  startAt,
  onReady,
  onClosing,
  onClosed,
}: {
  items: CanvasItem[];
  initialIndex: number;
  /** The canvas clip's time at the handoff, so the full source starts in sync. */
  startAt?: number;
  /** The viewer has a decoded frame and is starting its fade-in. */
  onReady?: () => void;
  /** The canvas should sync/prepare the exit; resolve when it is ready. */
  onClosing?: (index: number, time?: number) => void | Promise<void>;
  onClosed: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const [closing, setClosing] = useState(false);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(reduce);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  const closingRef = useRef(false);
  const openedRef = useRef(false);
  const flightRef = useRef<ReturnType<typeof animate> | null>(null);

  const item = items[index];
  const media = item?.media;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Wait for the initial source to have a frame before fading the DOM over
  // the WebGL plane. A slow source keeps the plane visible instead of cutting
  // to a blank or a poster.
  useLayoutEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const frame = frameRef.current;
    if (!frame) return;

    frame.style.transform = "none";
    frame.style.opacity = "0";

    if (reduce) {
      onReady?.();
      const animation = animate(
        frame,
        { opacity: 1 },
        { duration: FADE_S, ease: "easeOut" },
      );
      flightRef.current = animation;
      void animation.finished.then(
        () => {
          if (flightRef.current === animation) flightRef.current = null;
        },
        () => undefined,
      );
      return;
    }

    let finished = false;
    let timer = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      setReady(true);
      onReady?.();
      frame.style.opacity = "0";
      const animation = animate(
        frame,
        { opacity: 1 },
        { duration: TRANSITION.handoffMs / 1000, ease: "easeOut" },
      );
      flightRef.current = animation;
      void animation.finished.then(
        () => {
          if (flightRef.current === animation) flightRef.current = null;
          frame.style.opacity = "1";
        },
        () => undefined,
      );
    };

    timer = window.setTimeout(finish, TRANSITION.mediaReadyTimeoutMs);

    if (media?.kind === "video") {
      const video = frame.querySelector("video");
      if (!video) {
        finish();
        return;
      }

      let waited = false;
      const waitFrame = () => {
        if (waited) return;
        waited = true;

        if (typeof video.requestVideoFrameCallback === "function") {
          video.requestVideoFrameCallback(() => finish());
        } else {
          requestAnimationFrame(() => finish());
        }
      };

      const seekAndWait = () => {
        if (
          startAt === undefined ||
          !Number.isFinite(startAt) ||
          video.readyState < 1
        ) {
          // No synced time: the first presented frame is enough.
          if (video.readyState >= 2) waitFrame();
          else video.addEventListener("canplay", waitFrame, { once: true });
          return;
        }

        if (Math.abs(video.currentTime - startAt) < 0.05) {
          waitFrame();
          return;
        }

        video.addEventListener("seeked", waitFrame, { once: true });
        try {
          video.currentTime = startAt;
        } catch {
          waitFrame();
        }
      };

      if (video.readyState >= 1) seekAndWait();
      else video.addEventListener("loadedmetadata", seekAndWait, { once: true });

      // The canvas may have started playing while this effect mounted; a seek
      // that lands later is still the frame to wait for.
      if (startAt !== undefined) {
        video.addEventListener("seeked", waitFrame, { once: true });
      }

      timer = window.setTimeout(finish, TRANSITION.mediaReadyTimeoutMs);
      return;
    }

    const image = frame.querySelector("img");
    if (image) {
      void image
        .decode()
        .then(finish)
        .catch(finish);
    } else {
      finish();
    }
    return;
  }, [media, onReady, reduce, startAt]);

  // Viewer controls and playback. The first piece inherits the canvas time.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || media?.kind !== "video") return;

    const videos = [...frame.querySelectorAll("video")];
    const cleanups: (() => void)[] = [];
    const seekTo = index === initialIndex ? startAt : undefined;

    for (const video of videos) {
      video.controls = true;
      video.muted = true;
      const start = () => {
        video.muted = true;
        void video.play().catch(() => {
          // The controls and poster remain the manual path.
        });
      };
      const seek = () => {
        if (
          seekTo !== undefined &&
          Number.isFinite(seekTo) &&
          video.readyState >= 1
        ) {
          video.currentTime = seekTo;
        }
      };

      seek();
      start();
      video.addEventListener("loadedmetadata", seek);
      video.addEventListener("canplay", seek);
      video.addEventListener("loadeddata", start);
      video.addEventListener("canplay", start);
      cleanups.push(() => {
        video.removeEventListener("loadedmetadata", seek);
        video.removeEventListener("canplay", seek);
        video.removeEventListener("loadeddata", start);
        video.removeEventListener("canplay", start);
        video.pause();
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [index, initialIndex, media, startAt]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const frame = frameRef.current;
    if (!frame) {
      onClosed();
      return;
    }

    const video = frame.querySelector("video");
    const mediaTime =
      video && media?.kind === "video" ? video.currentTime : undefined;
    // Freeze the full-quality frame while the canvas seeks its persistent
    // clip to the same time; the viewer stays visible until that is ready.
    video?.pause();

    const prepared = onClosing?.(indexRef.current, mediaTime);

    void Promise.resolve(prepared)
      .catch(() => undefined)
      .then(() => {
        const animation = animate(
          frame,
          { opacity: 0 },
          {
            duration: reduce ? FADE_S : TRANSITION.closeCrossFadeMs / 1000,
            ease: "easeOut",
          },
        );
        flightRef.current = animation;
        void animation.finished.then(onClosed, onClosed);
      });
  }, [media, onClosed, onClosing, reduce]);

  const step = useCallback(
    (direction: number) => {
      if (items.length < 2) return;

      setIndex((current) => {
        const next = (current + direction) % items.length;
        return next < 0 ? next + items.length : next;
      });
    },
    [items.length],
  );

  useEffect(() => {
    overlayRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (closingRef.current) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (event.target instanceof HTMLVideoElement) return;

        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
        return;
      }

      if (event.key !== "Tab") return;

      const root = overlayRef.current;
      if (!root) return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (
          active === first ||
          !(active instanceof Node) ||
          !root.contains(active)
        ) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }

      if (
        active === last ||
        !(active instanceof Node) ||
        !root.contains(active)
      ) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [close, step]);

  // Focus returns after the close commit, once the canvas is no longer inert.
  useEffect(() => {
    return () => {
      requestAnimationFrame(() => {
        if (document.querySelector(".cv-viewer")) return;

        document
          .querySelector<HTMLElement>("[data-canvas-surface]")
          ?.focus({ preventScroll: true });
      });
    };
  }, []);

  if (!item || !media) return null;

  const size = fitBox(
    media.width,
    media.height,
    viewport.width,
    viewport.height,
  );
  const label = media.caption || media.alt || "Media viewer";
  const chromeVisible = reduce || ready;

  return (
    <div
      ref={overlayRef}
      className="cv-viewer"
      data-closing={closing || undefined}
      data-ready={chromeVisible || undefined}
      data-start-at={startAt !== undefined ? startAt.toFixed(2) : "none"}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
    >
      <div className="cv-viewer__backdrop" aria-hidden="true" onClick={close} />

      <div className="cv-viewer__stage">
        <div className="cv-viewer__slot">
          <div
            ref={frameRef}
            className="cv-viewer__frame"
            style={{ width: size.width, height: size.height }}
          >
            <div className="cv-viewer__content">
              <AnimatePresence initial={false}>
                <motion.div
                  key={item.key}
                  className="cv-viewer__slide"
                  data-media-id={media.id}
                  data-media-kind={media.kind}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.18,
                    ease: "easeOut",
                  }}
                >
                  {media.kind === "image" ? (
                    <MediaImage
                      media={media}
                      alt={media.alt}
                      priority
                      sizes={`${size.width}px`}
                      className="cv-viewer__media"
                    />
                  ) : (
                    <MediaVideo
                      media={media}
                      alt={media.alt}
                      className="cv-viewer__media"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {media.caption ? (
          <motion.p
            key={`${item.key}-caption`}
            className="cv-viewer__caption"
            initial={false}
            animate={{
              opacity: closing ? 0 : chromeVisible ? 1 : 0,
            }}
            transition={{
              duration: closing ? 0.15 : reduce ? 0 : 0.18,
              delay:
                closing || !chromeVisible || reduce
                  ? 0
                  : TRANSITION.captionDelayMs / 1000,
              ease: "easeOut",
            }}
          >
            {media.caption}
          </motion.p>
        ) : null}
      </div>

      <button
        type="button"
        className="cv-viewer__close"
        aria-label="Close media viewer"
        onClick={close}
      >
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}
