"use client";

import { AnimatePresence, animate, motion, releaseElement } from "motion/react";
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
import { MORPH_EASE, flipFrom, toBox } from "@/components/work/morph";
import type { Box } from "@/components/work/morph";
import type { CanvasItem } from "./infinite-canvas";

/**
 * The focus flight, from the repo's motion scale:
 * --duration-medium-7 for the open, --duration-medium-1 for the close, and
 * --ease-emphasized-standard for both. The close is deliberately quicker than
 * the open because the reader has already decided to leave.
 */
const OPEN_S = 0.36;
const CLOSE_S = 0.24;
const FADE_S = 0.12;
const LEAVE_SCALE = 0.96;

const FOCUSABLE =
  'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/** Fit a media ratio inside the viewer's allowance, keeping its aspect. */
function fitBox(
  width: number,
  height: number,
  viewportW: number,
  viewportH: number,
): { width: number; height: number } {
  const scale = Math.min(
    (viewportW * 0.88) / width,
    (viewportH * 0.8) / height,
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The frame's untransformed layout box, whatever flight is currently applied.
 * Temporarily clearing the inline transform is exact in a flex/centred stage,
 * where offsetLeft would have to account for the caption's changing height.
 * This runs only on open and close, never per frame.
 */
function layoutBox(element: HTMLElement): Box {
  const previous = element.style.transform;

  element.style.transform = "none";
  const box = toBox(element.getBoundingClientRect());
  element.style.transform = previous;

  return box;
}

/**
 * Full-screen media viewer.
 *
 * Opening FLIPs the frame out of the clicked WebGL plane's projected rect onto
 * its fit-to-viewport box; closing flies it back to the current plane. Only
 * transform and opacity animate. ←/→ move through the canvas's content order
 * with a crossfade instead of another FLIP, and the dialog traps focus, closes
 * on Esc/backdrop, and hands focus back to the canvas surface when it leaves.
 */
export function FocusViewer({
  items,
  initialIndex,
  originRect,
  getTargetRect,
  onClosing,
  onClosed,
}: {
  items: CanvasItem[];
  initialIndex: number;
  /** The clicked plane's screen rect, captured before it is hidden. */
  originRect: Box;
  /** The current plane rect for a close after ←/→ stepping. */
  getTargetRect: (index: number) => Box | null;
  /** The reverse flight has started; the shell can stop dimming the canvas. */
  onClosing?: () => void;
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

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  const flightRef = useRef<ReturnType<typeof animate> | null>(null);
  const closingRef = useRef(false);
  const openedRef = useRef(false);

  const item = items[index];
  const media = item?.media;

  // Synced after commit: every reader of indexRef is an event handler or an
  // unmount cleanup, never render.
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

  // Opening flight: projected plane -> the frame's resting box. The frame is
  // laid out at its final size from the first paint, so only a transform ever
  // moves.
  useLayoutEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const frame = frameRef.current;
    if (!frame) return;

    const frameBox = layoutBox(frame);
    const from = originRect;
    flightRef.current?.stop();
    releaseElement(frame);

    if (
      !reduce &&
      from.width > 0 &&
      from.height > 0 &&
      Number.isFinite(from.left) &&
      Number.isFinite(from.top)
    ) {
      const pose = flipFrom(from, frameBox);

      frame.style.transformOrigin = "left top";
      frame.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scaleX}, ${pose.scaleY})`;

      const animation = animate(
        frame,
        { x: 0, y: 0, scaleX: 1, scaleY: 1 },
        { duration: OPEN_S, ease: MORPH_EASE },
      );

      flightRef.current = animation;
      void animation.finished.then(
        () => {
          if (flightRef.current !== animation) return;

          flightRef.current = null;
          releaseElement(frame);
          frame.style.removeProperty("transform");
          frame.style.removeProperty("transform-origin");
        },
        () => undefined,
      );
      return;
    }

    // No measurable plane (or reduced motion): a fade is the gentle equivalent.
    frame.style.opacity = "0";
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
  }, [originRect, reduce]);

  // MediaVideo's short-loop contract is a silent ambient loop with no controls;
  // in the viewer the clip is the subject, so give it the native transport. HLS
  // clips already arrive with controls.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || media?.kind !== "video") return;

    const videos = [...frame.querySelectorAll("video")];
    const cleanups: (() => void)[] = [];

    for (const video of videos) {
      video.controls = true;
      // Autoplay muted; the native controls are the way to unmute.
      video.muted = true;
      const start = () => {
        video.muted = true;
        void video.play().catch(() => {
          // The controls and poster remain the manual path.
        });
      };

      start();
      video.addEventListener("loadeddata", start);
      video.addEventListener("canplay", start);
      cleanups.push(() => {
        video.removeEventListener("loadeddata", start);
        video.removeEventListener("canplay", start);
        video.pause();
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [index, media]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    onClosing?.();

    const frame = frameRef.current;
    if (!frame) {
      onClosed();
      return;
    }

    const layout = layoutBox(frame);
    const visual = toBox(frame.getBoundingClientRect());
    const target = reduce ? null : getTargetRect(indexRef.current);

    flightRef.current?.stop();
    releaseElement(frame);

    if (reduce) {
      const animation = animate(
        frame,
        { opacity: 0 },
        { duration: FADE_S, ease: "easeOut" },
      );
      flightRef.current = animation;
      void animation.finished.then(onClosed, onClosed);
      return;
    }

    if (target) {
      if (target.width > 0 && target.height > 0) {
        const start = flipFrom(visual, layout);
        const end = flipFrom(target, layout);

        // Set the visual start explicitly: the open flight may still have been
        // running, and its stopped state is not something to rely on.
        frame.style.transformOrigin = "left top";
        frame.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) scale(${start.scaleX}, ${start.scaleY})`;

        const animation = animate(
          frame,
          {
            x: end.x,
            y: end.y,
            scaleX: end.scaleX,
            scaleY: end.scaleY,
          },
          { duration: CLOSE_S, ease: MORPH_EASE },
        );

        flightRef.current = animation;
        void animation.finished.then(onClosed, onClosed);
        return;
      }
    }

    // No copy of this item is on screen: leave in place rather than fly to an
    // off-screen point.
    frame.style.transform = "none";
    frame.style.transformOrigin = "50% 50%";
    const animation = animate(
      frame,
      { opacity: 0, scale: LEAVE_SCALE },
      { duration: CLOSE_S, ease: MORPH_EASE },
    );
    flightRef.current = animation;
    void animation.finished.then(onClosed, onClosed);
  }, [getTargetRect, onClosed, onClosing, reduce]);

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
    // The dialog itself takes focus so the accessible name is announced; Tab
    // then lands on the close button inside the trap.
    overlayRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      // The close flight is already leaving; a step now would move the frame
      // out from under it.
      if (closingRef.current) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        // Native video controls use the arrow keys for seeking.
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
        // A new viewer opened before this frame; it owns focus now.
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

  return (
    <div
      ref={overlayRef}
      className="cv-viewer"
      data-closing={closing || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
    >
      <div className="cv-viewer__backdrop" aria-hidden="true" onClick={close} />

      <div className="cv-viewer__stage">
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

        {media.caption ? (
          <motion.p
            key={`${item.key}-caption`}
            className="cv-viewer__caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduce ? 0 : 0.18,
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
