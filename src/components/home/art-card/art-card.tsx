"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { RingLayers } from "../ring-hover";
import { useReducedMotion } from "../use-reduced-motion";
import { ArtDialog } from "./art-dialog";
import { ArtImage, artImageSrc } from "./art-image";
import { PaintingFrame } from "./painting-frame";
import {
  ShredStrips,
  shredExitDrift,
  shredStripMotion,
  type ShredSegmentMotion,
  type ShredStripMotion,
} from "./shred-strips";
import { useRibbonSway } from "./use-ribbon-sway";
import "./art-card.css";

/**
 * The home's daily painting card.
 *
 * Server data is the first frame: the frame already has today's aspect, so
 * hydration changes nothing in layout. The card is the plain ring surface the
 * other home cards use; the label sits left and the frame right.
 *
 * Two interactions share the card:
 * - clicking the painting pulls it down through the frame's bottom rod and
 *   shreds the part that has passed into hanging strips (Banksy's "Love is in
 *   the Bin", jammed halfway); clicking again finishes the shred, the ribbons
 *   fall away and a fresh copy slides in;
 * - clicking anywhere else — or the keyboard-only "View full screen" button —
 *   opens the full view: a native modal dialog with the 1686px image and the
 *   museum label.
 *
 * There is one painting per UTC day; no browsing state, controls or date fetch.
 */

type ArtCardProps = {
  art: DailyArt;
};

type ShredPhase = "idle" | "shredding" | "shredded" | "exiting";

const CATCH_MS = 120;
const DESCENT_MS = 2400;
const JAM_MS = 200;
const SHRED_MS = CATCH_MS + DESCENT_MS + JAM_MS;
const FINISH_MS = 1000;
const FINISH_RAMP_AT = 0.12;
const FALL_MS = 650;
/** The fresh painting is "printed" in: an even feed with a line-feed pulse every step. */
export const PRINT_MS = 3150;
export const PRINT_STEP_MS = 150;
/** Each line feed lurches this far past the steady feed, then the feed lags back. */
const PRINT_PULSE_PX = 1.5;
/** The lurch takes this share of a step; the rest is the steady, slightly slower feed. */
const PRINT_PULSE_SHARE = 0.3;
const PRINT_LURCH_EASE = "cubic-bezier(0.2, 0, 0, 1)";
const REDUCED_CROSSFADE_MS = 150;

const CATCH_DOWN_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const CATCH_UP_EASE = "cubic-bezier(0.55, 0, 1, 0.45)";
const JAM_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const FINISH_RAMP_EASE = "cubic-bezier(0.5, 0, 1, 1)";
const FALL_EASE = "cubic-bezier(0.55, 0, 1, 0.45)";

/*
 * One timeline: a short catch judder, the long mechanical descent (linear, a
 * motor, not a spring), then the jam stop with a 4px rebound. The canvas and
 * every strip track share it, and both are as tall as the painting, so the
 * ribbon below the rod is exactly the part of the painting that has passed
 * through.
 */
const CATCH_DOWN_AT = CATCH_MS / 3 / SHRED_MS;
const CATCH_END_AT = CATCH_MS / SHRED_MS;
const DESCENT_END_AT = (CATCH_MS + DESCENT_MS) / SHRED_MS;

function canvasShredKeyframes(): Keyframe[] {
  return [
    {
      offset: 0,
      transform: "translate3d(0, 0, 0)",
      easing: CATCH_DOWN_EASE,
    },
    {
      offset: CATCH_DOWN_AT,
      transform: "translate3d(0, 3px, 0)",
      easing: CATCH_UP_EASE,
    },
    {
      offset: CATCH_END_AT,
      transform: "translate3d(0, 0, 0)",
      easing: "linear",
    },
    {
      offset: DESCENT_END_AT,
      transform: "translate3d(0, calc(50% + 4px), 0)",
      easing: JAM_EASE,
    },
    { offset: 1, transform: "translate3d(0, 50%, 0)" },
  ];
}

function trackShredKeyframes(): Keyframe[] {
  return [
    {
      offset: 0,
      transform: "translate3d(0, -100%, 0)",
      easing: CATCH_DOWN_EASE,
    },
    {
      offset: CATCH_DOWN_AT,
      transform: "translate3d(0, calc(-100% + 3px), 0)",
      easing: CATCH_UP_EASE,
    },
    {
      offset: CATCH_END_AT,
      transform: "translate3d(0, -100%, 0)",
      easing: "linear",
    },
    {
      offset: DESCENT_END_AT,
      transform: "translate3d(0, calc(-50% + 4px), 0)",
      easing: JAM_EASE,
    },
    { offset: 1, transform: "translate3d(0, -50%, 0)" },
  ];
}

/*
 * Each joint curls in during the descent, so the ribbon straightens out of the
 * slot and bends more and more as the strip emerges.
 */
function segmentShredKeyframes(segment: ShredSegmentMotion): Keyframe[] {
  return [
    { offset: 0, transform: "rotate(0deg)" },
    { offset: CATCH_END_AT, transform: "rotate(0deg)", easing: "linear" },
    {
      offset: DESCENT_END_AT,
      transform: `rotate(${segment.rotate})`,
      easing: JAM_EASE,
    },
    { offset: 1, transform: `rotate(${segment.rotate})` },
  ];
}

/* Finish: the rest of the painting feeds through, a short ramp then constant. */
function canvasFinishKeyframes(): Keyframe[] {
  return [
    {
      offset: 0,
      transform: "translate3d(0, 50%, 0)",
      easing: FINISH_RAMP_EASE,
    },
    {
      offset: FINISH_RAMP_AT,
      transform: "translate3d(0, 53%, 0)",
      easing: "linear",
    },
    { offset: 1, transform: "translate3d(0, 100%, 0)" },
  ];
}

function trackFinishKeyframes(): Keyframe[] {
  return [
    {
      offset: 0,
      transform: "translate3d(0, -50%, 0)",
      easing: FINISH_RAMP_EASE,
    },
    {
      offset: FINISH_RAMP_AT,
      transform: "translate3d(0, -47%, 0)",
      easing: "linear",
    },
    { offset: 1, transform: "translate3d(0, 0, 0)" },
  ];
}

function stripFallKeyframes(strip: ShredStripMotion): Keyframe[] {
  const drift = shredExitDrift(strip.index);

  return [
    { transform: `translate3d(${strip.sway}, 0, 0) rotate(0deg)` },
    {
      transform: `translate3d(calc(${strip.sway} + ${drift.drift.toFixed(2)}px), 0, 0) rotate(${drift.rotate.toFixed(2)}deg)`,
    },
  ];
}

/*
 * The printer feed: the fresh copy moves from -100% to 0 at a steady speed, and
 * every PRINT_STEP_MS a line feed pulls it PRINT_PULSE_PX ahead of the steady
 * line, after which it lags back, so it reads as a mechanism, not an ease. The
 * pulse is zero at every step boundary, so the feed never drifts from the
 * steady line, and it ends exactly at 0. Transform only.
 */
export function printFeedKeyframes(): Keyframe[] {
  const steps = Math.round(PRINT_MS / PRINT_STEP_MS);
  const at = (progress: number, px: number) =>
    `translate3d(0, calc(${(-100 + 100 * progress).toFixed(4)}% + ${px}px), 0)`;
  const frames: Keyframe[] = [];

  for (let step = 0; step < steps; step += 1) {
    const start = step / steps;
    const lurch = start + PRINT_PULSE_SHARE / steps;

    frames.push(
      {
        offset: start,
        transform: at(start, -PRINT_PULSE_PX),
        easing: PRINT_LURCH_EASE,
      },
      { offset: lurch, transform: at(lurch, 0), easing: "linear" },
    );
  }

  frames.push({ offset: 1, transform: at(1, 0) });

  return frames;
}

export function ArtCard({ art }: ArtCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const openDialog = useCallback(() => setDialogOpen(true), []);

  return (
    <article
      className="ring-host art-card flex-1 rounded-lg"
      aria-label="Daily painting"
      onClick={openDialog}
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="art-card-body">
        <ArtScene key={art.date} art={art} onOpen={openDialog} />
      </div>

      {dialogOpen ? <ArtDialog art={art} open onClose={closeDialog} /> : null}
    </article>
  );
}

/**
 * One artwork's label + frame. The image-failure state lives here so a scene
 * remount starts clean; the card itself has no changing art to reset.
 *
 * The shred is a small state machine rather than a queue: a click during a
 * descent is ignored, so there are no half states to reconcile. The strips
 * only exist between the first click and the end of the exit.
 */
function ArtScene({ art, onOpen }: { art: DailyArt; onOpen: () => void }) {
  const [failureSrc, setFailureSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<ShredPhase>("idle");
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const stripsRef = useRef<HTMLDivElement>(null);
  const freshRef = useRef<HTMLImageElement>(null);
  const imageSrc = art.imageId ? artImageSrc(art.imageId, "card") : null;
  const imageUnavailable = imageSrc !== null && failureSrc === imageSrc;
  const imageLoaded = imageSrc !== null && loadedSrc === imageSrc;
  const canShred = imageLoaded && !imageUnavailable;
  const shredded = phase !== "idle";
  const noteId = useId();
  const meta = [art.dateDisplay, art.medium].filter(Boolean).join(" · ");

  const handleAvailable = useCallback(
    (src: string) => {
      if (src !== imageSrc) return;

      setFailureSrc(null);
      setLoadedSrc(src);
    },
    [imageSrc],
  );

  const handleUnavailable = useCallback(
    (src: string) => {
      if (src === imageSrc) setFailureSrc(src);
    },
    [imageSrc],
  );

  const toggleShred = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!canShred) return;

      setPhase((current) => {
        if (current === "idle") return reduce ? "shredded" : "shredding";
        if (current === "shredded") return "exiting";

        return current;
      });
    },
    [canShred, reduce],
  );

  useRibbonSway(stripsRef, phase === "shredded" && !reduce);

  useEffect(() => {
    if (phase !== "shredding" && phase !== "exiting") return;

    if (reduce) {
      // Reduced motion has no descent: a shred that was already running (the
      // preference flipped mid-shred) lands on its jammed state, and an exit is
      // a single crossfade back to the intact painting.
      const timeout = window.setTimeout(
        () => setPhase(phase === "shredding" ? "shredded" : "idle"),
        phase === "shredding" ? 0 : REDUCED_CROSSFADE_MS,
      );

      return () => window.clearTimeout(timeout);
    }

    const canvas = canvasRef.current;
    const stripsLayer = stripsRef.current;

    if (!canvas || !stripsLayer) {
      setPhase(phase === "shredding" ? "shredded" : "idle");
      return;
    }

    const shredding = phase === "shredding";
    const strips = Array.from(stripsLayer.children) as HTMLElement[];
    const models = shredStripMotion(strips.length);
    const animations: Animation[] = [];
    const timing = (
      duration: number,
      easing = "linear",
      delay = 0,
    ): KeyframeAnimationOptions => ({ duration, easing, delay, fill: "both" });

    animations.push(
      canvas.animate(
        shredding ? canvasShredKeyframes() : canvasFinishKeyframes(),
        timing(shredding ? SHRED_MS : FINISH_MS),
      ),
    );

    strips.forEach((strip, index) => {
      const model = models[index];
      const track = strip.querySelector<HTMLElement>(".shred-strip-track");
      const segments = Array.from(
        strip.querySelectorAll<HTMLElement>(
          ".shred-strip-segment:not([data-root])",
        ),
      );

      if (track) {
        animations.push(
          track.animate(
            shredding ? trackShredKeyframes() : trackFinishKeyframes(),
            timing(shredding ? SHRED_MS : FINISH_MS),
          ),
        );
      }

      if (shredding) {
        segments.forEach((segment, segmentIndex) => {
          animations.push(
            segment.animate(
              segmentShredKeyframes(model.segments[segmentIndex + 1]),
              timing(SHRED_MS),
            ),
          );
        });

        return;
      }

      // Exit stage B: each ribbon tilts and drifts as it falls, a few ms apart.
      animations.push(
        strip.animate(
          stripFallKeyframes(model),
          timing(FALL_MS, FALL_EASE, FINISH_MS + shredExitDrift(index).delay),
        ),
      );
    });

    if (!shredding) {
      animations.push(
        stripsLayer.animate(
          [
            { transform: "translate3d(0, 0, 0)", opacity: 1 },
            { transform: "translate3d(0, 140%, 0)", opacity: 0 },
          ],
          timing(FALL_MS, FALL_EASE, FINISH_MS),
        ),
      );

      const fresh = freshRef.current;

      if (fresh) {
        animations.push(
          fresh.animate(
            printFeedKeyframes(),
            timing(PRINT_MS, "linear", FINISH_MS),
          ),
        );
      }
    }

    let cancelled = false;

    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (!cancelled) setPhase(shredding ? "shredded" : "idle");
      })
      .catch(() => {
        // Cancelling a retargeted animation is not a failure.
      });

    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [phase, reduce]);

  return (
    <div className="art-card-scene">
      <div className="art-card-label">
        <p className="art-card-kicker">Today’s painting</p>
        <h3 className="art-card-title">{art.title}</h3>
        <p className="art-card-artist">{art.artist}</p>
        {meta ? <p className="art-card-meta">{meta}</p> : null}
        <p className="art-card-synopsis">{art.synopsis}</p>
        {imageUnavailable ? (
          <p className="art-card-image-note">Image unavailable</p>
        ) : null}
        <button
          type="button"
          className="art-card-fullscreen"
          aria-haspopup="dialog"
          aria-describedby={imageUnavailable ? noteId : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          View full screen
        </button>
      </div>

      <button
        type="button"
        className="art-card-painting-button"
        data-shred-phase={phase}
        aria-label={shredded ? "Finish the shred" : "Shred the painting"}
        aria-pressed={shredded}
        aria-describedby={imageUnavailable ? noteId : undefined}
        disabled={!canShred}
        onClick={toggleShred}
      >
        <PaintingFrame
          art={art}
          shred={
            imageSrc && shredded ? (
              <ShredStrips src={imageSrc} containerRef={stripsRef} />
            ) : undefined
          }
        >
          <div ref={canvasRef} className="art-card-canvas">
            <ArtImage
              art={art}
              onUnavailable={handleUnavailable}
              onAvailable={handleAvailable}
            />
          </div>
          {imageSrc && phase === "exiting" && !reduce ? (
            // The same cached 843w file: the fresh copy slides in while the
            // ribbons fall, then swaps for the real image with no visible change.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={freshRef}
              className="art-card-fresh"
              src={imageSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          ) : null}
        </PaintingFrame>
      </button>

      {imageUnavailable ? (
        <p id={noteId} className="sr-only">
          Image unavailable. The painting image service did not respond.
        </p>
      ) : null}
    </div>
  );
}
