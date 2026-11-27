"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
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

const SERVER_VIEWPORT: { width: number; height: number } = {
  width: 1440,
  height: 900,
};
let viewportSnapshot = SERVER_VIEWPORT;

/** Hydration-safe viewport: the server snapshot keeps the first render equal. */
function readViewport(): { width: number; height: number } {
  if (typeof window === "undefined") return SERVER_VIEWPORT;

  const width = window.innerWidth;
  const height = window.innerHeight;

  if (viewportSnapshot.width !== width || viewportSnapshot.height !== height) {
    viewportSnapshot = { width, height };
  }

  return viewportSnapshot;
}

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function serverViewport(): { width: number; height: number } {
  return SERVER_VIEWPORT;
}

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
  open = true,
  canvasOwned = false,
  pending = false,
  onReady,
  onClosing,
  onCloseLanded,
  onReopen,
  onReopenLanded,
  onClosed,
  onStep,
}: {
  items: CanvasItem[];
  initialIndex: number;
  /** Keep the viewer mounted and hidden between opens. */
  open?: boolean;
  /** The canvas clip's time at the handoff, so the full source starts in sync. */
  startAt?: number;
  /** The clicked tile's visible rect; the full-res layer FLIPs from here. */
  openRect?: Box;
  /**
   * The opened media is the focused WebGL plane, not a DOM layer. The viewer
   * renders only the chrome until the reader steps to another item.
   */
  canvasOwned?: boolean;
  /** The WebGL open is still running; keep the chrome hidden. */
  pending?: boolean;
  /** The viewer has decoded its exact source and is starting the full-res zoom. */
  onReady?: () => void;
  /** Start the close; returns the landing rect and the canvas prep promise. */
  onClosing?: (
    index: number,
    time?: number,
    canvasOwned?: boolean,
  ) => CloseTarget | null;
  /** The viewer landed; reveal the prepared canvas tile before unmounting. */
  onCloseLanded?: () => void;
  /** The close was interrupted; hand the hidden plane back to the canvas. */
  onReopen?: () => void;
  /** The reopen reached the focus box; the canvas cover can be dropped. */
  onReopenLanded?: () => void;
  onClosed: () => void;
  /** The reader stepped off the canvas-owned media onto a DOM slide. */
  onStep?: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );
  const viewport = useSyncExternalStore(
    subscribeViewport,
    readViewport,
    serverViewport,
  );
  const [closing, setClosing] = useState(false);
  const [stepped, setStepped] = useState(false);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(reduce || canvasOwned);
  const [zooming, setZooming] = useState(false);
  const domMedia = open && (!canvasOwned || stepped);
  // The opened video starts only after the zoom lands, so a playing 1080p
  // layer is never rastered while the frame is being transformed. A still
  // layer carries the flight and hands over on the first presented frame.
  const [playback, setPlayback] = useState(reduce);
  const [videoVisible, setVideoVisible] = useState(reduce);
  const [posterVisible, setPosterVisible] = useState(true);
  /** The clip's exact live frame, so the still and playback start together. */
  const [posterSrc, setPosterSrc] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      const last = Math.max(items.length - 1, 0);
      setIndex(Math.min(Math.max(initialIndex, 0), last));
      setClosing(false);
      setStepped(false);
      setReady(reduce || canvasOwned);
      setZooming(false);
      setPlayback(reduce);
      setVideoVisible(reduce);
      setPosterVisible(true);
      setPosterSrc(null);
    }
  }

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
  const openGenerationRef = useRef(0);
  const openRunRef = useRef({
    cancelled: false,
    timer: 0,
    settle: 0,
    capture: 0,
    poster: 0,
  });

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

  // Re-arm the one-shot open machinery when the viewer is shown again. The
  // component itself stays mounted (hidden) so the click never pays its mount.
  useLayoutEffect(() => {
    closeTokenRef.current += 1;
    closingRef.current = false;
    landedRef.current = false;
    openedRef.current = false;
    frameFlightRef.current?.cancel();
    frameFlightRef.current = null;
    flightRef.current?.stop();
    flightRef.current = null;
  }, [open]);

  // The canvas hands over the clicked tile's rect. The viewer starts there,
  // waits for its exact decoded image/video, then zooms the full-res layer to
  // the focus box. The low-res canvas plane is hidden by onReady; there is no
  // low-res -> high-res swap during the zoom.
  useLayoutEffect(() => {
    const generation = ++openGenerationRef.current;
    const run = openRunRef.current;

    const cleanup = () => {
      // Strict Mode runs the effect, cleans it up and runs it again in the
      // same commit. Defer the cancellation one microtask so the remount can
      // claim the run; a real unmount (no later generation) still clears
      // every timer and rAF.
      queueMicrotask(() => {
        if (openGenerationRef.current !== generation) return;
        run.cancelled = true;
        window.clearTimeout(run.timer);
        cancelAnimationFrame(run.settle);
        cancelAnimationFrame(run.capture);
        cancelAnimationFrame(run.poster);
      });
    };

    if (!open) return cleanup;
    if (openedRef.current) return cleanup;
    openedRef.current = true;
    run.cancelled = false;
    run.timer = 0;
    run.settle = 0;
    run.capture = 0;
    run.poster = 0;

    const frame = frameRef.current;
    if (!frame) return cleanup;

    if (canvasOwned) {
      // The WebGL plane is already at the focus box and carries the open;
      // this layer is transparent chrome only.
      frame.style.opacity = "1";
      frame.style.transform = "none";
      readyRef.current = true;
      return cleanup;
    }

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

    const finish = () => {
      if (run.cancelled || finished) return;
      finished = true;
      window.clearTimeout(run.timer);
      readyRef.current = true;
      setReady(true);
      onReady?.();
      frame.style.opacity = "1";

      if (!initial || reduce) {
        frame.style.transform = "none";
        setZooming(false);
        setVideoVisible(true);
        setPlayback(true);
        return;
      }

      let lastFrameAt = performance.now();
      let attempts = 0;
      let fastFrames = 0;

      const startWhenPainted = () => {
        if (run.cancelled || closingRef.current) return;

        const now = performance.now();
        const frameMs = now - lastFrameAt;
        lastFrameAt = now;
        attempts += 1;
        fastFrames = frameMs < 20 ? fastFrames + 1 : 0;

        if (fastFrames < 2 && attempts < 12) {
          run.settle = requestAnimationFrame(startWhenPainted);
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
            onComplete: () => {
              setZooming(false);
              frame.style.transform = "none";
              // The still is at the clip's live time; start playback only
              // once the frame has landed, so no playing layer is scaled.
              setVideoVisible(true);
              setPlayback(true);
            },
          },
        );
        flightRef.current = animation;
        void animation.finished.then(
          () => {
            if (flightRef.current === animation) flightRef.current = null;
          },
          () => undefined,
        );
      };

      run.settle = requestAnimationFrame(startWhenPainted);
    };

    // Long enough for a throttled full-res asset; the tile stays visible with
    // its press state until this fires.
    run.timer = window.setTimeout(finish, 8000);

    if (media?.kind === "video") {
      const video = videoInSlide(frame, media.id);
      if (!video) {
        finish();
        return cleanup;
      }

      let waited = false;

      // Capture the paused clip's exact live frame as the still the flight
      // paints. Playback resumes from the same frame after the landing, so
      // the full-res layer never changes content mid-zoom.
      const capturePoster = () => {
        if (run.cancelled || waited || closingRef.current) return;
        waited = true;

        run.capture = requestAnimationFrame(() => {
          if (run.cancelled || closingRef.current) return;

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

            void image.decode().catch(() => undefined).then(() => {
              if (run.cancelled || closingRef.current) return;
              setPosterSrc(src);
              // Let React swap the still, then paint it once before the FLIP.
              run.poster = requestAnimationFrame(() => {
                run.poster = requestAnimationFrame(finish);
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

      return cleanup;
    }

    const image = frame.querySelector("img");
    if (image) {
      void image.decode().then(finish).catch(finish);
    } else {
      finish();
    }
    return cleanup;
  }, [
    canvasOwned,
    media,
    onReady,
    open,
    openRect,
    reduce,
    startAt,
  ]);

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

    if (canvasOwned && !stepped) {
      // The WebGL plane owns the shrink. Keep the chrome for the canvas
      // close timeline, then unmount. A null target means the canvas
      // cancelled an in-flight open and the grid is already back.
      const target = onClosing?.(indexRef.current, undefined, true);
      if (!target) {
        onClosed();
        return;
      }

      const token = ++closeTokenRef.current;
      window.setTimeout(
        () => {
          if (token !== closeTokenRef.current) return;
          landedRef.current = true;
          onClosed();
        },
        reduce ? TRANSITION.reducedFadeMs : TRANSITION.closeTotalMs,
      );
      return;
    }

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

    const target = onClosing?.(indexRef.current, mediaTime, false) ?? null;

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
  }, [
    canvasOwned,
    flipToRect,
    media,
    onCloseLanded,
    onClosed,
    onClosing,
    reduce,
    stepped,
  ]);

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
        onReopenLanded?.();
      },
      () => undefined,
    );
  }, [media, onReopen, onReopenLanded, reduce]);

  const step = useCallback(
    (direction: number) => {
      if (items.length < 2) return;

      // The first step leaves the canvas-owned media for the DOM viewer so
      // stepping keeps its existing slide behavior.
      onStep?.();
      // A canvas-owned open never runs the DOM video finish path, so the DOM
      // fallback's video layer is still hidden and deferred. The step hands
      // the media to the DOM; reveal and play its video from here.
      setVideoVisible(true);
      setPlayback(true);
      setStepped(true);
      setIndex((current) => {
        const next = (current + direction) % items.length;
        return next < 0 ? next + items.length : next;
      });
    },
    [items.length, onStep],
  );

  useEffect(() => {
    if (open) overlayRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    return () => {
      closeTokenRef.current += 1;
      frameFlightRef.current?.cancel();
      flightRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (closingRef.current) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (pending || event.target instanceof HTMLVideoElement) return;

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
  }, [close, open, pending, step]);

  const wasOpenRef = useRef(open);

  // Focus returns after a close commit, once the canvas is no longer inert.
  // The initial closed mount must not steal focus from the page.
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open || !wasOpen) return;

    requestAnimationFrame(() => {
      if (document.querySelector(".cv-viewer:not([data-hidden])")) return;

      document
        .querySelector<HTMLElement>("[data-canvas-surface]")
        ?.focus({ preventScroll: true });
    });
  }, [open]);

  if (!item || !media) return null;

  const size = fitBox(
    media.width,
    media.height,
    viewport.width,
    viewport.height,
  );
  const label = media.caption || media.alt || "Media viewer";
  const chromeVisible = !pending && (reduce || ready);

  return (
    <div
      ref={overlayRef}
      className="cv-viewer"
      data-lenis-prevent
      data-closing={closing || undefined}
      data-hidden={!open || undefined}
      data-ready={chromeVisible || undefined}
      data-zooming={zooming || undefined}
      data-pending={pending || undefined}
      data-canvas-owned={canvasOwned && !domMedia || undefined}
      data-start-at={startAt !== undefined ? startAt.toFixed(2) : "none"}
      role="dialog"
      aria-modal={open || undefined}
      aria-hidden={!open || undefined}
      aria-label={label}
      inert={!open}
      tabIndex={-1}
    >
      <div className="cv-viewer__backdrop" aria-hidden="true" onClick={close} />

      <div className="cv-viewer__stage">
        <div className="cv-viewer__slot">
          <div
            ref={frameRef}
            className="cv-viewer__frame"
            style={{ width: size.width, height: size.height }}
            onClick={closing && domMedia ? reopen : undefined}
          >
            {domMedia ? (
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
            ) : null}
          </div>
        </div>

        {domMedia ? (
          <motion.p
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
        ) : (
          <p
            className="cv-viewer__caption"
            style={{
              opacity: closing ? 0 : chromeVisible ? 1 : 0,
              transitionProperty: "opacity",
              transitionDuration: reduce ? "0ms" : `${closing ? 150 : 180}ms`,
              transitionTimingFunction: "var(--ease-decelerate)",
              transitionDelay:
                closing || !chromeVisible || reduce
                  ? "0ms"
                  : `${TRANSITION.captionDelayMs}ms`,
            }}
          >
            {projectLabel(item.project)}
          </p>
        )}
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
