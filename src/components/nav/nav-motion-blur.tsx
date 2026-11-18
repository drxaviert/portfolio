"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Prototype: vertical motion blur on the nav during a drawer open or close.
 *
 * This is an A/B layer, not part of the nav's motion. It never touches the
 * flight's timing, easing, distance or resting position: the dock still moves
 * exactly as it did, and this only reads its live vertical velocity and paints
 * a Y-only SVG blur on top while it moves. At rest the filter property is
 * removed entirely, so text is sharp and nothing is left compositing.
 *
 * The controller lives outside React (like nav-flight.ts) because it writes to
 * the DOM every frame: no re-render, no state, one rect read and one attribute
 * write per frame.
 *
 * Modes: off | subtle (3px peak) | strong (6px peak), chosen with `?mb=` and by
 * the dev toggle. Skipped on reduced motion and on WebKit, whose SVG filter
 * path is too slow to sit on a per-frame animation.
 */

export type NavBlurMode = "off" | "subtle" | "strong";

export const NAV_BLUR_FILTER_ID = "nav-mb";

const PEAK: Record<Exclude<NavBlurMode, "off">, number> = {
  subtle: 3,
  strong: 6,
};

/**
 * stdDeviation px per px of vertical travel per 60Hz frame. The drawer's open
 * peaks near 45px/frame at the start of its 900ms flight and is still around
 * 22px/frame at half the travel, so this saturates the mode's peak for the fast
 * first half and lets go as the curve settles. (Strong touches its 6px peak only
 * on the fastest frames; subtle holds its 3px through mid-travel.)
 */
const BLUR_PER_PX = 0.135;

/** One 60Hz frame: velocities are normalised to it so 120Hz screens match. */
const FRAME_MS = 1000 / 60;

/**
 * How long after the handed duration the loop gives up by itself. The flight
 * clearing the blur is the normal path; this only covers a flight that never
 * settles (a paused frame loop, an animation stopped with no successor).
 */
const IDLE_SLACK_MS = 250;

function isMode(value: string | null): value is NavBlurMode {
  return value === "off" || value === "subtle" || value === "strong";
}

/**
 * The query string is read once and kept: opening a drawer rewrites the URL to
 * the study, and the mode must survive that.
 */
let fromQuery: NavBlurMode | null | undefined;
let toggleQuery: boolean | undefined;

function requestedMode(): NavBlurMode | null {
  if (typeof window === "undefined") return null;

  if (fromQuery === undefined) {
    const value = new URLSearchParams(window.location.search).get("mb");
    fromQuery = isMode(value) ? value : null;
  }

  return fromQuery;
}

function toggleRequested(): boolean {
  if (typeof window === "undefined") return false;

  if (toggleQuery === undefined) {
    toggleQuery =
      new URLSearchParams(window.location.search).get("mbtoggle") === "1";
  }

  return toggleQuery;
}

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

/* ------------------------------ mode store ------------------------------ */

/** What the toggle last picked, over any `?mb=`. Cleared only by a reload. */
let override: NavBlurMode | null = null;
const listeners = new Set<() => void>();

export function getNavBlurMode(): NavBlurMode {
  return override ?? requestedMode() ?? "subtle";
}

function subscribeMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setNavBlurMode(mode: NavBlurMode): void {
  override = mode;
  // Switching off mid-flight must not leave the filter stuck on.
  if (mode === "off") endNavBlur();
  listeners.forEach((listener) => listener());
}

/**
 * The mode is live, but the server cannot know `?mb=`: it renders the default
 * and the client corrects on hydration, exactly like use-reduced-motion.
 */
export function useNavBlurMode(): NavBlurMode {
  return useSyncExternalStore(subscribeMode, getNavBlurMode, () => "subtle");
}

/* ------------------------------ the loop ------------------------------ */

let raf = 0;
/** Bumped by every end, so a loop left over from an earlier flight dies. */
let token = 0;
let tracked: HTMLElement | null = null;
let gaussian: SVGFEGaussianBlurElement | null = null;

/**
 * Drops the blur at once. Called when the flight settles, when the dock
 * unmounts, when the mode goes off, and by the loop's own deadline: a quick
 * open→close interleaved with this can never leave the filter on.
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
 * Follow `element` for one flight of `durationSeconds` and paint its vertical
 * velocity into the shared filter. A no-op when the prototype is off, reduced
 * motion is on, or the engine is WebKit.
 */
export function beginNavBlur(
  element: HTMLElement,
  durationSeconds: number,
): void {
  const mode = getNavBlurMode();
  if (mode === "off" || prefersReducedMotion() || isWebKit()) return;

  const node = gaussianNode();
  if (!node) return;

  // A quick open→close restarts here: the previous loop dies with its token
  // and this one takes the element over from wherever it is right now.
  endNavBlur();
  const mine = token;

  tracked = element;
  gaussian = node;
  element.style.filter = `url(#${NAV_BLUR_FILTER_ID})`;

  let lastTop = element.getBoundingClientRect().top;
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

    const active = getNavBlurMode();
    const peak = active === "off" ? 0 : PEAK[active];
    const deviation = Math.min(peak, speed * BLUR_PER_PX);
    node.setAttribute("stdDeviation", `0 ${deviation.toFixed(2)}`);

    if (now >= deadline) {
      endNavBlur();
      return;
    }

    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
}

/* --------------------------------- UI --------------------------------- */

/** The inline filter the dock's `filter` property points at. */
function Filter() {
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
        // Vertical blur only. The region is padded well past the bar so the
        // blurred edges and the card's shadow are not clipped while it moves.
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

/**
 * Prototype-only mode switch. Renders only with `?mbtoggle=1` or in dev, and
 * sits above the nav's layer so it stays usable while the drawer is open.
 */
function Toggle() {
  const mode = useNavBlurMode();
  const visible = process.env.NODE_ENV !== "production";

  if (!visible && !toggleRequested()) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        // Clear of Next's dev indicator, which owns the bottom-left corner.
        bottom: 56,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 8,
        border: "1px dashed #f0abfc",
        background: "rgba(24, 24, 27, 0.92)",
        color: "#fafafa",
        font: "500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.04em",
        pointerEvents: "auto",
      }}
      data-nav-mb-toggle=""
    >
      <span style={{ padding: "0 4px", opacity: 0.7 }}>NAV MB</span>
      {(["off", "subtle", "strong"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setNavBlurMode(value)}
          aria-pressed={mode === value}
          style={{
            padding: "5px 8px",
            borderRadius: 5,
            border: "1px solid rgba(250, 250, 250, 0.18)",
            background: mode === value ? "#f0abfc" : "transparent",
            color: mode === value ? "#18181b" : "#fafafa",
            font: "inherit",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

/** The blur layer: its hidden filter, the dev toggle, and the cleanup. */
export function NavMotionBlur() {
  // Unmounting the nav (or HMR) must not leave a filter behind.
  useEffect(() => endNavBlur, []);

  return (
    <>
      <Filter />
      <Toggle />
    </>
  );
}
