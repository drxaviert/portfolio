"use client";

import type { CSSProperties } from "react";
import type { HorizonListeningTuning } from "@/components/horizon/horizon-background";
import { HORIZON_HOME_LISTENING } from "@/components/horizon/horizon-preset";
import { useLiveListeningTuning } from "@/components/horizon/listening-tuning";
import { BlurStack } from "@/components/work/blur-stack";
import "./viewport-edge-blur.css";

/**
 * The labs-style progressive blur at the viewport's top and bottom edges, on
 * the homepage: content scrolling under an edge blurs more the closer it gets
 * to it. Two fixed bands per edge, blur only (no surface tint) so the horizon
 * glow keeps its colour, and never in the way of the pointer.
 *
 * Two static stacks per edge, not one animated stack. The listening state
 * crossfades the tuned stack over the idle one with opacity only: changing a
 * backdrop-filter radius every frame across six bands measured 18.3ms frames
 * (50 of 273 over 16ms) on a 165Hz display, while the two static stacks stay
 * compositor-only. The idle stack is the current look; the listening stack is
 * pre-styled from the tuner (or the shipping preset) and the two opacities
 * trade places over the same 3.5s/1.2s listening ramp. Reduced motion uses the
 * 400ms crossfade.
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
type StackKind = "idle" | "listen";

function EdgeBlurStack({
  edge,
  kind,
  tuning,
}: {
  edge: Edge;
  kind: StackKind;
  tuning?: HorizonListeningTuning;
}) {
  const style =
    kind === "listen" && tuning
      ? ({
          "--edge-blur-tune-max": `${tuning.edgeBlurMax}px`,
          "--edge-blur-tune-height": `${tuning.edgeBlurHeight}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={`wd-edge-blur wd-edge-blur--${edge}`}
      data-edge-stack={kind}
      style={style}
      aria-hidden="true"
    >
      <BlurStack edge={edge} tint={false} />
    </div>
  );
}

export function ViewportEdgeBlur() {
  // Null in production/no tuner: the shipping preset is the current 8/172.
  const live = useLiveListeningTuning();
  const tuning = live ?? HORIZON_HOME_LISTENING;

  return (
    <>
      <EdgeBlurStack edge="top" kind="idle" />
      <EdgeBlurStack edge="top" kind="listen" tuning={tuning} />
      <EdgeBlurStack edge="bottom" kind="idle" />
      <EdgeBlurStack edge="bottom" kind="listen" tuning={tuning} />
    </>
  );
}
