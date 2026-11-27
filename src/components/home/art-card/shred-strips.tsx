"use client";

import type { CSSProperties, Ref } from "react";

export const SHRED_STRIP_COUNT = 18;
/** Segments per strip, including the strip root. Each joint adds a little bend. */
export const SHRED_SEGMENTS = 6;

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
  /** Segment 0 is the strip root; 1.. are its nested children. */
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
 * The strips' static geometry. Each strip is a chain of nested segments: every
 * segment hangs off its parent's bottom edge and rotates a little around its
 * own top edge, so the accumulated rotations read as a curling paper ribbon
 * that starts vertical at the slot and bends more towards the tip.
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
  // The first segment stays flush in the slot; only the joints below it bend.
  const joints = Math.max(1, segmentCount - 1);
  const weights = Array.from({ length: joints }, (_, joint) =>
    Math.pow(joint + 1, 1.35),
  );
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  return Array.from({ length: count }, (_, index) => {
    const half = Math.max(1, (count - 1) / 2);
    const spread = (index - (count - 1) / 2) / half;
    const sway = spread * MAX_OUTWARD_SWAY + (seeded(index, 1) * 2 - 1) * 0.8;
    const bend = -spread * MAX_OUTWARD_BEND + (seeded(index, 2) * 2 - 1) * 1.2;

    const segments = Array.from({ length: segmentCount }, (_, segment) => {
      const share = segment / Math.max(1, segmentCount - 1);
      const joint = segment - 1;
      const tilt =
        joint < 0
          ? 0
          : (bend * weights[joint]) / weightSum +
            (seeded(index, 10 + joint) * 2 - 1) * 0.22;

      return {
        // Show the bottom half of the painting, split evenly across the chain.
        positionY: `${(((segmentCount + segment) / (2 * segmentCount - 1)) * 100).toFixed(3)}%`,
        rotate: `${tilt.toFixed(2)}deg`,
        shadeFrom: MAX_TIP_SHADE * share,
        shadeTo: MAX_TIP_SHADE * ((segment + 1) / segmentCount),
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

/**
 * The painting as vertical strips, each showing its own slice of the same
 * 843w image and built from nested segments so it bends like paper. The strips
 * hang from the frame's bottom edge and slide out of the shred slot as the
 * painting descends.
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
      {strips.map((strip) => {
        const [root] = strip.segments;

        return (
          <span
            key={strip.index}
            className="shred-strip"
            style={
              {
                "--strip-index": strip.index,
                "--strip-offset": strip.backgroundPosition,
                "--strip-sway": strip.sway,
                "--seg-position-y": root.positionY,
                "--seg-shade-from": root.shadeFrom,
                "--seg-shade-to": root.shadeTo,
              } as CSSProperties
            }
          >
            <StripSegment segments={strip.segments} index={1} />
          </span>
        );
      })}
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
