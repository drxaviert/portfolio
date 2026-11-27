"use client";

import { useEffect } from "react";

/**
 * Vertical motion blur on the nav while it flies between the homepage row and
 * the drawer's row.
 *
 * It is a layer on top of the flight, never a change to it: nothing here
 * touches the timing, easing, distance or resting position. The dock moves
 * exactly as it did; this reads its live vertical velocity and paints a Y-only
 * blur while it moves, then removes the filter entirely, so the bar at rest is
 * sharp and nothing is left compositing.
 *
 * The controller lives outside React (like nav-flight.ts) because it writes to
 * the DOM every frame: no re-render, one rect read and one attribute write per
 * frame. Skipped on reduced motion and on WebKit, whose SVG filter path is too
 * slow to sit on a per-frame animation.
 */

const NAV_BLUR_FILTER_ID = "nav-mb";

/** The blur's peak, in px, on the fastest part of the flight. */
const PEAK_PX = 4;

/**
 * The velocity at which the blur reaches its peak, in px per 60Hz frame: the
 * speed the nav is still doing at half of the drawer's travel. Faster frames
 * sit at the peak; slower ones taper with the motion.
 */
const REFERENCE_SPEED = 22;

/** One 60Hz frame: velocities are normalised to it so 120Hz screens match. */
const FRAME_MS = 1000 / 60;

/**
 * Padded past the bar by the blur's own spread, with a floor that keeps the
 * card's shadow inside the region.
 */
const REGION_PAD = Math.max(32, Math.ceil(PEAK_PX * 3.5));

/**
 * How long after the handed duration the loop gives up by itself. The flight
 * clearing the blur is the normal path; this covers a flight that never settles
 * (a paused frame loop, an animation stopped with no successor).
 */
const IDLE_SLACK_MS = 250;

function isWebKit(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  // Every browser on iOS is WebKit underneath, Chrome included.
  if (/iPad|iPhone|iPod/.test(ua)) return true;

  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function gaussianNode(): SVGFEGaussianBlurElement | null {
  return document.querySelector<SVGFEGaussianBlurElement>(
    `#${NAV_BLUR_FILTER_ID} feGaussianBlur`,
  );
}

let raf = 0;
/** Bumped by every end, so a loop left over from an earlier flight dies. */
let token = 0;
let tracked: HTMLElement | null = null;
let gaussian: SVGFEGaussianBlurElement | null = null;

/**
 * Drops the blur at once. Called when the flight settles, when the dock
 * unmounts, and by the loop's own deadline: a quick open→close interleaved with
 * this can never leave the filter on.
 */
export function endNavBlur(): void {
  token += 1;

  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  tracked?.style.removeProperty("filter");
  gaussian?.setAttribute("stdDeviation", "0 0");
  tracked = null;
  gaussian = null;
}

/**
 * The filter region in the element's own user space. A larger region than the
 * bar is what keeps the smear from being cut off at its edges while it moves.
 */
function setRegion(size: { width: number; height: number }): void {
  const filter = document.getElementById(NAV_BLUR_FILTER_ID);
  if (!filter) return;

  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("x", String(-REGION_PAD));
  filter.setAttribute("y", String(-REGION_PAD));
  filter.setAttribute("width", String(Math.ceil(size.width + REGION_PAD * 2)));
  filter.setAttribute(
    "height",
    String(Math.ceil(size.height + REGION_PAD * 2)),
  );
}

/**
 * Follow `element` for one flight of `durationSeconds` and paint its vertical
 * velocity into the shared filter. A no-op when reduced motion is on or the
 * engine is WebKit.
 */
export function beginNavBlur(
  element: HTMLElement,
  durationSeconds: number,
): void {
  if (prefersReducedMotion() || isWebKit()) return;

  const node = gaussianNode();
  if (!node) return;

  // A quick open→close restarts here: the previous loop dies with its token
  // and this one takes the element over from wherever it is right now.
  endNavBlur();
  const mine = token;

  tracked = element;
  gaussian = node;

  // One read for the start position and the region. The region is the dock's
  // layout box, not the first flight frame: the flight scales the bar from the
  // home fit up to 1x, so a region measured from the scaled start would clip
  // the bar as it grows. The filter is applied only once the region is right,
  // so nothing is clipped on the first frame.
  const start = element.getBoundingClientRect();
  setRegion({
    width: element.offsetWidth || start.width,
    height: element.offsetHeight || start.height,
  });
  element.style.filter = `url(#${NAV_BLUR_FILTER_ID})`;

  let lastTop = start.top;
  let lastNow = performance.now();
  const deadline = lastNow + durationSeconds * 1000 + IDLE_SLACK_MS;

  const tick = (now: number) => {
    if (mine !== token) return;

    // One read, one write per frame. getBoundingClientRect includes the
    // flight's transform, so this is the bar's real vertical velocity.
    const top = element.getBoundingClientRect().top;
    const speed =
      Math.abs(top - lastTop) * (FRAME_MS / Math.max(1, now - lastNow));
    lastTop = top;
    lastNow = now;

    const deviation = PEAK_PX * Math.min(1, speed / REFERENCE_SPEED);
    node.setAttribute("stdDeviation", `0 ${deviation.toFixed(2)}`);

    if (now >= deadline) {
      endNavBlur();
      return;
    }

    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
}

/** The inline filter the dock's `filter` property points at. */
export function NavMotionBlur() {
  // Unmounting the nav (or HMR) must not leave a filter behind.
  useEffect(() => endNavBlur, []);

  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <filter
        id={NAV_BLUR_FILTER_ID}
        // The real region is written per flight by setRegion(); these are only
        // the values before the first move.
        x="-8%"
        y="-50%"
        width="116%"
        height="200%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation="0 0" />
      </filter>
    </svg>
  );
}
