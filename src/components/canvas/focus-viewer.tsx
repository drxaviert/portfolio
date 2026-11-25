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
import { HANDOFF_BEZIER, HANDOFF_EASE, TRANSITION, fitBox } from "./transition";
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
 * The open is a FLIP from the clicked tile's rect to the focus box. For a
 * clip, the layer that flies is a still captured from the paused full-res
 * element at the tile's live time; the element itself starts playing only
 * after the flight lands, so no playing 1080p layer is rastered mid-zoom.
 * The canvas keeps the pressed tile until that still is ready, then hands
 * over. On close the full-res layer shrinks back to the clicked tile
 * immediately; the canvas prepares the tile in parallel and only reveals it
 * on the landing frame.
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
  // The opened video starts only after the zoom lands, so a playing 1080p
  // layer is never rastered while the frame is being transformed. A still
  // layer carries the flight and hands over on the first presented frame.
  const [playback, setPlayback] = useState(reduce);
  const [videoVisible, setVideoVisible] = useState(reduce);
  const [posterVisible, setPosterVisible] = useState(true);
  /** The clip's exact live frame, so the still and playback start together. */
  const [posterSrc, setPosterSrc] = useState<string | null>(null);

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
  /** The still belongs to the item the viewer opened, not a stepped-to one. */
  const initialKey = items[initialIndex]?.key;

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
        setVideoVisible(true);
        setPlayback(true);
        placeChip();
        return;
      }

      // Let the decoded still (or the paused clip's first frame) finish its
      // one expensive raster before the transform starts. Wait for a frame
      // that actually lands on time instead of guessing a delay: the cost is
      // paid on the held tile, and the flight itself stays compositor-only.
      let lastFrameAt = performance.now();
      let attempts = 0;
      let fastFrames = 0;

      const startWhenPainted = () => {
        if (closingRef.current) return;

        const now = performance.now();
        const frameMs = now - lastFrameAt;
        lastFrameAt = now;
        attempts += 1;
        fastFrames = frameMs < 20 ? fastFrames + 1 : 0;

        if (fastFrames < 2 && attempts < 12) {
          requestAnimationFrame(startWhenPainted);
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
            ease: HANDOFF_BEZIER,
            onUpdate: placeChip,
            onComplete: () => {
              setZooming(false);
              frame.style.transform = "none";
              // The still is at the clip's live time; start playback only
              // once the frame has landed, so no playing layer is scaled.
              setVideoVisible(true);
              setPlayback(true);
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

      requestAnimationFrame(startWhenPainted);
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

      // Capture the paused clip's exact live frame as the still the flight
      // paints. Playback resumes from the same frame after the landing, so
      // the full-res layer never changes content mid-zoom.
      const capturePoster = () => {
        if (waited || closingRef.current) return;
        waited = true;

        requestAnimationFrame(() => {
          if (closingRef.current) return;

          try {
            const sourceWidth = video.videoWidth || media.width;
            const sourceHeight = video.videoHeight || media.height;
            // The focus box is up to 88vw wide. Capture at least 1280px so a
            // wide window stays sharp without encoding the full 4K source.
            const targetWidth = Math.max(
              1280,
              Math.round(window.innerWidth * 0.88),
            );
            const scale = Math.min(1, targetWidth / sourceWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(sourceWidth * scale);
            canvas.height = Math.round(sourceHeight * scale);
            const context = canvas.getContext("2d");
            if (!context) throw new Error("no 2d context");

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const src = canvas.toDataURL("image/jpeg", 0.92);
            const image = new Image();
            image.src = src;

            void image
              .decode()
              .catch(() => undefined)
              .then(() => {
                if (closingRef.current) return;
                setPosterSrc(src);
                // Let React swap the still, then paint it once before the FLIP.
                requestAnimationFrame(() => {
                  requestAnimationFrame(finish);
                });
              });
          } catch {
            // Canvas capture is best-effort; the manifest poster is the
            // fallback and the clip starts from the top to match it.
            try {
              video.currentTime = 0;
            } catch {
              // A seek that cannot land keeps the current frame.
            }
            finish();
          }
        });
      };

      const seekAndCapture = () => {
        if (
          startAt === undefined ||
          !Number.isFinite(startAt) ||
          video.readyState < 1
        ) {
          capturePoster();
          return;
        }

        if (Math.abs(video.currentTime - startAt) < 0.05) {
          capturePoster();
          return;
        }

        video.addEventListener("seeked", capturePoster, { once: true });
        try {
          video.currentTime = startAt;
        } catch {
          capturePoster();
        }
      };

      if (video.readyState >= 2) seekAndCapture();
      else video.addEventListener("loadeddata", seekAndCapture, { once: true });

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

  // The still stays on top until the clip has presented its first frame, so
  // the first expensive video raster happens behind identical content.
  useEffect(() => {
    if (!videoVisible || !posterVisible || media?.kind !== "video") return;

    const frame = frameRef.current;
    const video = frame ? videoInSlide(frame, media.id) : null;
    if (!video) {
      setPosterVisible(false);
      return;
    }

    if (typeof video.requestVideoFrameCallback !== "function") {
      const timer = window.setTimeout(() => setPosterVisible(false), 180);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const request = video.requestVideoFrameCallback(() => {
      if (!cancelled) setPosterVisible(false);
    });

    return () => {
      cancelled = true;
      video.cancelVideoFrameCallback?.(request);
    };
  }, [media, posterVisible, videoVisible]);

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
        easing: HANDOFF_EASE,
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
        duration: TRANSITION.reopenMs,
        easing: HANDOFF_EASE,
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
                    <>
                      <div
                        className="cv-viewer__video"
                        data-visible={videoVisible || undefined}
                      >
                        <MediaVideo
                          media={media}
                          alt={media.alt}
                          className="cv-viewer__media"
                          viewerOwned
                          loopMuted
                          deferPlayback={!playback}
                        />
                      </div>
                      {posterVisible && item.key === initialKey ? (
                        <div
                          className="cv-viewer__poster"
                          style={{
                            backgroundImage: `url("${posterSrc ?? media.poster.jpg}")`,
                          }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </>
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
