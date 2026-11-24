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
import type { Box } from "@/components/work/morph";
import type { CanvasItem, CloseTarget } from "./infinite-canvas";
import { projectLabel } from "./items";
import { TRANSITION, fitBox } from "./transition";
import "./focus-viewer.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/** The video inside the slide for this media, not an exiting neighbour. */
function videoInSlide(
  frame: HTMLElement,
  mediaId: string,
): HTMLVideoElement | null {
  const slide = [...frame.querySelectorAll(".cv-viewer__slide")].find(
    (element) => element.getAttribute("data-media-id") === mediaId,
  );

  return slide?.querySelector("video") ?? null;
}

/**
 * Full-screen media viewer.
 *
 * The open is a FLIP of the viewer's exact full-res layer from the clicked
 * tile's rect to the focus box, so the low-res canvas never grows and nothing
 * is swapped mid-zoom. The canvas keeps the pressed tile until the viewer has
 * decoded its source, then hands over. On close the full-res layer shrinks
 * back to the clicked tile immediately; the canvas prepares the tile in
 * parallel and only reveals it on the landing frame.
 */
export function FocusViewer({
  items,
  initialIndex,
  startAt,
  openRect,
  onReady,
  onClosing,
  onCloseLanded,
  onReopen,
  onReopenLanded,
  onClosed,
}: {
  items: CanvasItem[];
  initialIndex: number;
  /** The canvas clip's time at the handoff, so the full source starts in sync. */
  startAt?: number;
  /** The clicked tile's visible rect; the full-res layer FLIPs from here. */
  openRect?: Box;
  /** The viewer has decoded its exact source and is starting the full-res zoom. */
  onReady?: () => void;
  /** Start the close; returns the landing rect and the canvas prep promise. */
  onClosing?: (index: number, time?: number) => CloseTarget | null;
  /** The viewer landed; reveal the prepared canvas tile before unmounting. */
  onCloseLanded?: () => void;
  /** The close was interrupted; hand the hidden plane back to the canvas. */
  onReopen?: () => void;
  /** The reopen reached the focus box; the canvas cover can be dropped. */
  onReopenLanded?: () => void;
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
  const [zooming, setZooming] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  const closingRef = useRef(false);
  const openedRef = useRef(false);
  const readyRef = useRef(reduce);
  const landedRef = useRef(false);
  const closeTokenRef = useRef(0);
  const flightRef = useRef<ReturnType<typeof animate> | null>(null);
  const frameFlightRef = useRef<Animation | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);

  const placeChip = useCallback(() => {
    const frame = frameRef.current;
    const chip = captionRef.current;
    if (!frame || !chip) return;

    const rect = frame.getBoundingClientRect();
    // Vertically centred in the gap below the opened content, and it tracks
    // the frame's animated rect during the open/close zoom.
    chip.style.top = `${(rect.bottom + window.innerHeight) / 2}px`;
    chip.style.left = "50%";
  }, []);

  const item = items[index];
  const media = item?.media;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useLayoutEffect(() => {
    placeChip();
  }, [media, placeChip, ready, viewport]);

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

  // The canvas hands over the clicked tile's rect. The viewer starts there,
  // waits for its exact decoded image/video, then zooms the full-res layer to
  // the focus box. The low-res canvas plane is hidden by onReady; there is no
  // low-res -> high-res swap during the zoom.
  useLayoutEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const frame = frameRef.current;
    if (!frame) return;

    let initial: { x: number; y: number; sx: number; sy: number } | null = null;

    if (openRect && !reduce) {
      const rect = frame.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        initial = {
          x: openRect.left + openRect.width / 2 - (rect.left + rect.width / 2),
          y: openRect.top + openRect.height / 2 - (rect.top + rect.height / 2),
          sx: openRect.width / rect.width,
          sy: openRect.height / rect.height,
        };
        frame.style.transformOrigin = "center";
        frame.style.transform = `translate(${initial.x}px, ${initial.y}px) scale(${initial.sx}, ${initial.sy})`;
      }
    }

    frame.style.opacity = "0";
    setZooming(Boolean(initial));

    let finished = false;
    let timer = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      readyRef.current = true;
      setReady(true);
      onReady?.();
      frame.style.opacity = "1";

      if (!initial || reduce) {
        frame.style.transform = "none";
        setZooming(false);
        placeChip();
        return;
      }

      const animation = animate(
        frame,
        {
          x: [initial.x, 0],
          y: [initial.y, 0],
          scaleX: [initial.sx, 1],
          scaleY: [initial.sy, 1],
        },
        {
          duration: TRANSITION.growMs / 1000,
          ease: "easeOut",
          onUpdate: placeChip,
          onComplete: () => {
            setZooming(false);
            frame.style.transform = "none";
            placeChip();
          },
        },
      );
      flightRef.current = animation;
      void animation.finished.then(
        () => {
          if (flightRef.current === animation) flightRef.current = null;
          placeChip();
        },
        () => undefined,
      );
    };

    // Long enough for a throttled full-res asset; the tile stays visible with
    // its press state until this fires.
    timer = window.setTimeout(finish, 8000);

    if (media?.kind === "video") {
      const video = videoInSlide(frame, media.id);
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
      else
        video.addEventListener("loadedmetadata", seekAndWait, { once: true });

      // The canvas may have started playing while this effect mounted; a seek
      // that lands later is still the frame to wait for.
      if (startAt !== undefined) {
        video.addEventListener("seeked", waitFrame, { once: true });
      }

      return;
    }

    const image = frame.querySelector("img");
    if (image) {
      void image.decode().then(finish).catch(finish);
    } else {
      finish();
    }
    return;
  }, [media, onReady, openRect, placeChip, reduce, startAt]);

  /** A rect in viewport space -> the frame's translate/scale FLIP values. */
  const flipToRect = useCallback((rect: Box) => {
    const frame = frameRef.current;
    if (!frame) return null;

    const width = frame.offsetWidth || 1;
    const height = frame.offsetHeight || 1;
    const centreX = frame.offsetLeft + width / 2;
    const centreY = frame.offsetTop + height / 2;

    return {
      x: rect.left + rect.width / 2 - centreX,
      y: rect.top + rect.height / 2 - centreY,
      scaleX: rect.width / width,
      scaleY: rect.height / height,
    };
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const frame = frameRef.current;
    if (!frame) {
      onClosed();
      return;
    }

    const video =
      media?.kind === "video" ? videoInSlide(frame, media.id) : null;
    const mediaTime = video ? video.currentTime : undefined;
    // Freeze the viewer frame while the canvas seeks its persistent clip.
    video?.pause();

    const target = onClosing?.(indexRef.current, mediaTime) ?? null;

    if (!target || !target.rect) {
      // Closing mid-open, before the viewer was revealed. The canvas has
      // already restored the grid; there is nothing to shrink.
      onClosed();
      return;
    }

    const token = ++closeTokenRef.current;
    const landing = () => {
      if (token !== closeTokenRef.current) return;
      landedRef.current = true;
      onCloseLanded?.();
      onClosed();
    };

    if (reduce) {
      void target.prepared.catch(() => undefined).then(landing);
      return;
    }

    // Stop the open zoom at its current transform, then reverse it to the
    // resting tile rect. Transform only, on the compositor; no layout reads
    // and no state updates per frame. The canvas prep runs in parallel.
    const computedTransform = getComputedStyle(frame).transform;
    flightRef.current?.stop();
    flightRef.current = null;
    frameFlightRef.current?.cancel();
    frameFlightRef.current = null;

    frame.style.transformOrigin = "center";
    frame.style.transform =
      computedTransform === "none" ? "none" : computedTransform;
    frame.style.opacity = "1";

    const end = flipToRect(target.rect);
    if (!end) {
      landing();
      return;
    }

    setZooming(true);
    const animation = frame.animate(
      [
        {
          transform:
            computedTransform === "none"
              ? "translate(0px, 0px) scale(1, 1)"
              : computedTransform,
        },
        {
          transform: `translate(${end.x}px, ${end.y}px) scale(${end.scaleX}, ${end.scaleY})`,
        },
      ],
      {
        duration: TRANSITION.closeShrinkMs,
        easing: "cubic-bezier(0, 0, 0.58, 1)",
        fill: "forwards",
      },
    );
    frameFlightRef.current = animation;

    void Promise.all([
      animation.finished.catch(() => undefined),
      target.prepared.catch(() => undefined),
    ]).then(landing);
  }, [flipToRect, media, onCloseLanded, onClosed, onClosing, reduce]);

  const reopen = useCallback(() => {
    if (!closingRef.current || landedRef.current) return;

    // A click on the shrinking frame reverses the close from its current
    // transform. The canvas keeps the opened plane hidden until the next
    // close starts again.
    closeTokenRef.current += 1;
    closingRef.current = false;
    setClosing(false);

    const frame = frameRef.current;
    const currentTransform = frame ? getComputedStyle(frame).transform : "none";

    frameFlightRef.current?.cancel();
    frameFlightRef.current = null;
    onReopen?.();

    if (!frame) return;

    const video =
      media?.kind === "video" ? videoInSlide(frame, media.id) : null;
    if (video) void video.play().catch(() => undefined);

    if (reduce) {
      frame.style.transform = "none";
      setZooming(false);
      placeChip();
      onReopenLanded?.();
      return;
    }

    frame.style.transformOrigin = "center";
    frame.style.transform =
      currentTransform === "none" ? "none" : currentTransform;
    frame.style.opacity = "1";
    setZooming(true);

    const token = closeTokenRef.current;
    const animation = frame.animate(
      [
        {
          transform:
            currentTransform === "none"
              ? "translate(0px, 0px) scale(1, 1)"
              : currentTransform,
        },
        { transform: "translate(0px, 0px) scale(1, 1)" },
      ],
      {
        duration: 260,
        easing: "cubic-bezier(0, 0, 0.58, 1)",
        fill: "forwards",
      },
    );
    frameFlightRef.current = animation;

    void animation.finished.then(
      () => {
        if (token !== closeTokenRef.current) return;
        frame.style.transform = "none";
        setZooming(false);
        placeChip();
        onReopenLanded?.();
      },
      () => undefined,
    );
  }, [media, onReopen, onReopenLanded, placeChip, reduce]);

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
    return () => {
      closeTokenRef.current += 1;
      frameFlightRef.current?.cancel();
      flightRef.current?.stop();
    };
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
      data-zooming={zooming || undefined}
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
            onClick={closing ? reopen : undefined}
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
                      fullRes
                      sizes={`${size.width}px`}
                      className="cv-viewer__media"
                    />
                  ) : (
                    <MediaVideo
                      media={media}
                      alt={media.alt}
                      className="cv-viewer__media"
                      viewerOwned
                      loopMuted
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <motion.p
          ref={captionRef}
          key={`${item.key}-project`}
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
          {projectLabel(item.project)}
        </motion.p>
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
