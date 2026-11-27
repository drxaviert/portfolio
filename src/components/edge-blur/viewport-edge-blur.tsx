"use client";

import type { CSSProperties } from "react";
import { HORIZON_HOME_LISTENING } from "@/components/horizon/horizon-preset";
import { useLiveListeningTuning } from "@/components/horizon/listening-tuning";
import { BlurStack } from "@/components/work/blur-stack";
import "./viewport-edge-blur.css";

/**
 * The labs-style progressive blur at the viewport's top and bottom edges, on
 * the homepage: content scrolling under an edge blurs more the closer it gets
 * to it. One fixed band per edge, blur only (no surface tint) so the horizon
 * glow keeps its colour, and never in the way of the pointer.
 *
 * The listening ramp drives the blur radius and band height directly, as
 * registered `<length>` custom properties (viewport-edge-blur.css). It cannot
 * be an opacity crossfade between an idle and a listening stack: a
 * `backdrop-filter` inside an opacity group has an empty backdrop in Chrome,
 * so the listening bands paint nothing for the whole transition and the full
 * blur pops in on the frame opacity reaches 1. Interpolating the radius keeps
 * the six band filters re-evaluated on the same 3.5s/1.2s curve as the
 * horizon, and a CSS transition reverses from the current value mid-ramp.
 * Reduced motion uses the 400ms standard transition.
 *
 * Mounted by `/` itself (app/(site)/page.tsx), not by the root layout or this
 * component's own pathname check: `/work*` builds its homepage from its own
 * layout, so a study's direct load renders the page without these bands. A
 * study opened from `/` has the drawer panel over them, which covers the bands
 * exactly as before.
 *
 * Layer 40 (viewport-edge-blur.css): above the content and the entrance veil
 * (10), below the reader layer (50) and the nav dock (60).
 */

type Edge = "top" | "bottom";

function EdgeBlurStack({
  edge,
  tuning,
}: {
  edge: Edge;
  tuning: { edgeBlurMax: number; edgeBlurHeight: number };
}) {
  const style = {
    "--edge-blur-tune-max": `${tuning.edgeBlurMax}px`,
    "--edge-blur-tune-height": `${tuning.edgeBlurHeight}px`,
  } as CSSProperties;

  return (
    <div
      className={`wd-edge-blur wd-edge-blur--${edge}`}
      style={style}
      aria-hidden="true"
    >
      <BlurStack edge={edge} tint={false} />
    </div>
  );
}

export function ViewportEdgeBlur() {
  // Null in production/no tuner: the shipping preset is the listening target.
  const live = useLiveListeningTuning();
  const tuning = live ?? HORIZON_HOME_LISTENING;

  return (
    <>
      <EdgeBlurStack edge="top" tuning={tuning} />
      <EdgeBlurStack edge="bottom" tuning={tuning} />
    </>
  );
}
