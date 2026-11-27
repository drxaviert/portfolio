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
  shredStripMotion,
  type ShredSegmentMotion,
  type ShredStripMotion,
} from "./shred-strips";
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
 *   shreds the part that has passed into hanging strips; clicking again
 *   restores it (Banksy's "Love is in the Bin", jammed halfway);
 * - clicking anywhere else — or the keyboard-only "View full screen" button —
 *   opens the full view: a native modal dialog with the 1686px image and the
 *   museum label.
 *
 * There is one painting per UTC day; no browsing state, controls or date fetch.
 */

type ArtCardProps = {
  art: DailyArt;
};

type ShredPhase = "idle" | "shredding" | "shredded" | "restoring";

const CATCH_MS = 120;
const DESCENT_MS = 2400;
const JAM_MS = 200;
const SHRED_MS = CATCH_MS + DESCENT_MS + JAM_MS;
const RESTORE_MS = 900;
const REDUCED_CROSSFADE_MS = 150;

const CATCH_DOWN_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const CATCH_UP_EASE = "cubic-bezier(0.55, 0, 1, 0.45)";
const DESCENT_EASE = "cubic-bezier(0.3, 0, 0.7, 1)";
const JAM_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const RESTORE_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/*
 * One timeline: a short catch judder, the long mechanical descent, then the
 * jam stop with a 4px rebound. Both layers share it, so the intact painting and
 * the strips below the rod cross the slot at the same speed.
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
      easing: DESCENT_EASE,
    },
    {
      offset: DESCENT_END_AT,
      transform: "translate3d(0, calc(50% + 4px), 0)",
      easing: JAM_EASE,
    },
    { offset: 1, transform: "translate3d(0, 50%, 0)" },
  ];
}

function canvasRestoreKeyframes(): Keyframe[] {
  return [
    { offset: 0, transform: "translate3d(0, 50%, 0)" },
    { offset: 1, transform: "translate3d(0, 0, 0)" },
  ];
}

function stripShredKeyframes(strip: ShredStripMotion): Keyframe[] {
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
      easing: DESCENT_EASE,
    },
    {
      offset: DESCENT_END_AT,
      transform: `translate3d(${strip.sway}, 4px, 0)`,
      easing: JAM_EASE,
    },
    {
      offset: 1,
      transform: `translate3d(${strip.sway}, 0, 0)`,
    },
  ];
}

/*
 * Each joint curls in during the descent, so the ribbon straightens out of the
 * slot and bends more and more as the strip emerges. The tip's joints carry
 * the largest increments, which is what turns the accumulated rotation into a
 * curve rather than one rigid rotation.
 */
function segmentShredKeyframes(segment: ShredSegmentMotion): Keyframe[] {
  return [
    { offset: 0, transform: "rotate(0deg)" },
    { offset: CATCH_END_AT, transform: "rotate(0deg)", easing: DESCENT_EASE },
    {
      offset: DESCENT_END_AT,
      transform: `rotate(${segment.rotate})`,
      easing: JAM_EASE,
    },
    { offset: 1, transform: `rotate(${segment.rotate})` },
  ];
}

function stripRestoreKeyframes(strip: ShredStripMotion): Keyframe[] {
  return [
    {
      offset: 0,
      transform: `translate3d(${strip.sway}, 0, 0)`,
      easing: RESTORE_EASE,
    },
    {
      offset: 0.4,
      transform: "translate3d(0, -40%, 0)",
      easing: "linear",
    },
    { offset: 1, transform: "translate3d(0, -100%, 0)" },
  ];
}

function segmentRestoreKeyframes(segment: ShredSegmentMotion): Keyframe[] {
  return [
    {
      offset: 0,
      transform: `rotate(${segment.rotate})`,
      easing: RESTORE_EASE,
    },
    { offset: 0.4, transform: "rotate(0deg)", easing: "linear" },
    { offset: 1, transform: "rotate(0deg)" },
  ];
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
 * only exist between the first click and the end of the restore.
 */
function ArtScene({ art, onOpen }: { art: DailyArt; onOpen: () => void }) {
  const [failureSrc, setFailureSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<ShredPhase>("idle");
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const stripsRef = useRef<HTMLDivElement>(null);
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
        if (current === "shredded") return "restoring";

        return current;
      });
    },
    [canShred, reduce],
  );

  useEffect(() => {
    if (phase !== "shredding" && phase !== "restoring") return;

    if (reduce) {
      if (phase !== "restoring") return;

      const timeout = window.setTimeout(
        () => setPhase("idle"),
        REDUCED_CROSSFADE_MS,
      );

      return () => window.clearTimeout(timeout);
    }

    const canvas = canvasRef.current;
    const stripsLayer = stripsRef.current;

    if (!canvas || !stripsLayer) {
      setPhase(phase === "shredding" ? "shredded" : "idle");
      return;
    }

    const strips = Array.from(stripsLayer.children) as HTMLElement[];
    const models = shredStripMotion(strips.length);
    const shredding = phase === "shredding";
    const timing: KeyframeAnimationOptions = {
      duration: shredding ? SHRED_MS : RESTORE_MS,
      easing: "linear",
      fill: "both",
    };

    const animations = [
      canvas.animate(
        shredding ? canvasShredKeyframes() : canvasRestoreKeyframes(),
        timing,
      ),
    ];

    strips.forEach((strip, index) => {
      const model = models[index];

      animations.push(
        strip.animate(
          shredding ? stripShredKeyframes(model) : stripRestoreKeyframes(model),
          timing,
        ),
      );

      const segments = Array.from(
        strip.querySelectorAll(".shred-strip-segment"),
      ) as HTMLElement[];

      segments.forEach((segment, segmentIndex) => {
        const segmentModel = model.segments[segmentIndex + 1];

        animations.push(
          segment.animate(
            shredding
              ? segmentShredKeyframes(segmentModel)
              : segmentRestoreKeyframes(segmentModel),
            timing,
          ),
        );
      });
    });

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
        aria-label={shredded ? "Restore the painting" : "Shred the painting"}
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
