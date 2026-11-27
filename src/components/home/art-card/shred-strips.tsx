"use client";

import type { CSSProperties, Ref } from "react";

export const SHRED_STRIP_COUNT = 18;
/**
 * Segments per strip, including the strip root. Together they are the whole
 * painting's height: segment `s` shows the `s`-th slice of the image. The
 * lower half carries the curl, so a full curl of ~22deg over 11 joints leaves
 * about 2deg per joint: too small to read as a kink, even at 2x DPR.
 */
export const SHRED_SEGMENTS = 24;

export type ShredSegmentMotion = {
  /** The segment's slice of the painting, as a background-position-y percentage. */
  positionY: string;
  /** This joint's rotation, in degrees; the nesting accumulates it into a curve. */
  rotate: string;
  /** 0..1 black overlay at the segment's top and bottom; continuous down the strip. */
  shadeFrom: number;
  shadeTo: number;
};

export type ShredStripMotion = {
  index: number;
  backgroundPosition: string;
  sway: string;
  /** Segment 0 is the strip root (the painting's top); 1.. nest below it. */
  segments: ShredSegmentMotion[];
};

/** Deterministic 0..1 value from an index; no Math.random in render. */
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

/** Total curl at the tip of the outermost strips, in degrees. */
const MAX_OUTWARD_BEND = 21;
/** Outward drift of the outermost strips, in px. */
const MAX_OUTWARD_SWAY = 3;
/** How much darker the tip gets; the segments blend it continuously. */
const MAX_TIP_SHADE = 0.13;

/**
 * The strips' static geometry. Each strip is a chain of nested segments that
 * together cover the whole painting: every segment hangs off its parent's
 * bottom edge and rotates a little around its own top edge, so the accumulated
 * rotations read as a curling paper ribbon.
 *
 * Only the lower half of the chain is below the slot when the shred jams (the
 * painting stops halfway), so only that half bends and darkens; the upper half
 * stays straight and plain, and is what comes out when the shred finishes. The
 * first segment of the lower half stays flush in the slot.
 *
 * Left-half strips curl left (positive rotation, tip swings left), right-half
 * strips curl right, growing with distance from the centre, plus a little
 * seeded jitter. Exported so the WAAPI keyframes and the CSS end state share
 * exactly the same values — a re-render cannot make the strips jump.
 */
export function shredStripMotion(
  count = SHRED_STRIP_COUNT,
  segmentCount = SHRED_SEGMENTS,
): ShredStripMotion[] {
  const half = Math.floor(segmentCount / 2);
  const joints = Math.max(1, segmentCount - half - 1);
  const weights = Array.from({ length: joints }, (_, joint) =>
    Math.pow(joint + 1, 0.15),
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const lower = Math.max(1, segmentCount - half);

  return Array.from({ length: count }, (_, index) => {
    const centre = Math.max(1, (count - 1) / 2);
    const spread = (index - (count - 1) / 2) / centre;
    const sway = spread * MAX_OUTWARD_SWAY + (seeded(index, 1) * 2 - 1) * 0.8;
    const bend = -spread * MAX_OUTWARD_BEND + (seeded(index, 2) * 2 - 1) * 1.2;

    const segments = Array.from({ length: segmentCount }, (_, segment) => {
      const joint = segment - half - 1;
      const below = segment - half;
      const tilt =
        joint < 0
          ? 0
          : (bend * weights[joint]) / weightSum +
            (seeded(index, 10 + joint) * 2 - 1) * 0.08;

      return {
        positionY: `${((segment / Math.max(1, segmentCount - 1)) * 100).toFixed(3)}%`,
        rotate: `${tilt.toFixed(2)}deg`,
        shadeFrom: below < 0 ? 0 : (MAX_TIP_SHADE * below) / lower,
        shadeTo: below < 0 ? 0 : (MAX_TIP_SHADE * (below + 1)) / lower,
      };
    });

    return {
      index,
      backgroundPosition: `${(index / Math.max(1, count - 1)) * 100}%`,
      sway: `${sway.toFixed(2)}px`,
      segments,
    };
  });
}

/** The exit's seeded fall-away: extra rotation (deg), x drift (px), stagger (ms). */
export function shredExitDrift(index: number, count = SHRED_STRIP_COUNT) {
  const centre = Math.max(1, (count - 1) / 2);

  return {
    rotate: (seeded(index, 3) * 2 - 1) * 6,
    drift: (seeded(index, 4) * 2 - 1) * 8,
    delay: (Math.abs(index - (count - 1) / 2) / centre) * 60,
  };
}

/**
 * The painting as vertical strips, each showing its own slice of the same
 * 843w image and built from nested segments so it bends like paper. Every
 * strip's track is as tall as the whole painting and slides down through the
 * shred slot in step with the canvas, so the ribbon below the frame is always
 * exactly the part of the painting that has passed through.
 */
export function ShredStrips({
  src,
  containerRef,
}: {
  src: string;
  containerRef?: Ref<HTMLDivElement>;
}) {
  const strips = shredStripMotion();

  return (
    <div
      ref={containerRef}
      className="shred-strips"
      style={
        {
          "--shred-src": `url("${src}")`,
          "--shred-count": strips.length,
          "--shred-segments": SHRED_SEGMENTS,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {strips.map((strip) => (
        <span
          key={strip.index}
          className="shred-strip"
          style={
            {
              "--strip-index": strip.index,
              "--strip-offset": strip.backgroundPosition,
              "--strip-sway": strip.sway,
            } as CSSProperties
          }
        >
          <span className="shred-strip-track">
            <StripSegment segments={strip.segments} index={0} />
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Segment `index` nested inside segment `index - 1`, and so on down the chain.
 * The nesting is the curve: each child inherits every ancestor's rotation.
 */
function StripSegment({
  segments,
  index,
}: {
  segments: ShredSegmentMotion[];
  index: number;
}) {
  const segment = segments[index];

  if (!segment) return null;

  return (
    <span
      className="shred-strip-segment"
      data-root={index === 0 ? "true" : undefined}
      style={
        {
          "--seg-position-y": segment.positionY,
          "--seg-rotate": segment.rotate,
          "--seg-shade-from": segment.shadeFrom,
          "--seg-shade-to": segment.shadeTo,
        } as CSSProperties
      }
    >
      <StripSegment segments={segments} index={index + 1} />
    </span>
  );
}
