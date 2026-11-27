import { BlurStack } from "@/components/work/blur-stack";
import "./viewport-edge-blur.css";

/**
 * The labs-style progressive blur at the viewport's top and bottom edges, on
 * the homepage: content scrolling under an edge blurs more the closer it gets
 * to it. Two fixed bands, blur only (no surface tint) so the horizon glow keeps
 * its colour, and never in the way of the pointer.
 *
 * Mounted by `/` itself (app/(site)/page.tsx), not by the root layout or this
 * component's own pathname check: `/work*` builds its homepage from its own
 * layout, so a study's direct load renders the page without these bands. A
 * study opened from `/` has the drawer panel over them, which covers the bands
 * exactly as before.
 *
 * Layer 40 (viewport-edge-blur.css): above the content and the entrance veil
 * (10), below the reader layer (50) and the nav dock (60). Static CSS: no
 * scroll listener, nothing measured, nothing animated.
 */
export function ViewportEdgeBlur() {
  return (
    <>
      <div className="wd-edge-blur wd-edge-blur--top" aria-hidden="true">
        <BlurStack edge="top" tint={false} />
      </div>
      <div className="wd-edge-blur wd-edge-blur--bottom" aria-hidden="true">
        <BlurStack edge="bottom" tint={false} />
      </div>
    </>
  );
}
