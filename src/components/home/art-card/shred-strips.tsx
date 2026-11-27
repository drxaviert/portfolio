"use client";

import type { CSSProperties, Ref } from "react";

export const SHRED_STRIP_COUNT = 18;

export type ShredStripMotion = {
  index: number;
  backgroundPosition: string;
  sway: string;
  rotate: string;
};

/** Deterministic 0..1 value from an index; no Math.random in render. */
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

/** Outermost strips bend this far, in degrees; the centre ones stay straight. */
const MAX_OUTWARD_BEND = 9;
/** Outward drift of the outermost strips, in px. */
const MAX_OUTWARD_SWAY = 3;

/**
 * The strips' static geometry. Each strip bends outward from the centre about
 * its top edge: left-half strips curl left (clockwise), right-half strips curl
 * right, growing with distance from the centre, plus a little seeded jitter.
 * Exported so the WAAPI keyframes and the CSS end state share exactly the same
 * values — a re-render cannot make the strips jump.
 */
export function shredStripMotion(
  count = SHRED_STRIP_COUNT,
): ShredStripMotion[] {
  return Array.from({ length: count }, (_, index) => {
    const half = Math.max(1, (count - 1) / 2);
    const spread = (index - (count - 1) / 2) / half;
    const sway = spread * MAX_OUTWARD_SWAY + (seeded(index, 1) * 2 - 1) * 0.8;
    const rotation =
      -spread * MAX_OUTWARD_BEND + (seeded(index, 2) * 2 - 1) * 0.8;

    return {
      index,
      backgroundPosition: `${(index / Math.max(1, count - 1)) * 100}%`,
      sway: `${sway.toFixed(2)}px`,
      rotate: `${rotation.toFixed(2)}deg`,
    };
  });
}

/**
 * The painting as vertical strips, each showing its own slice of the same
 * 843w image. The slice is the painting's lower half: the strips hang from the
 * frame's bottom edge and slide out of the shred slot as the painting descends.
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
              "--strip-rotate": strip.rotate,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
