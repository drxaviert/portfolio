"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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
 * Strength is a peak in px (0–30). It comes from `?mb=<number>`, then from the
 * last value kept in localStorage, then 3px; the dev panel's slider and number
 * input write it live. Presets (off/subtle/strong/heavy) just move the slider.
 * Skipped on reduced motion and on WebKit, whose SVG filter path is too slow
 * to sit on a per-frame animation.
 */

export const NAV_BLUR_FILTER_ID = "nav-mb";

export const MIN_PEAK = 0;
export const MAX_PEAK = 30;
const DEFAULT_PEAK = 3;

/** Presets: the buttons set the peak, they are not a separate mode. */
const PRESETS = [
  { label: "off", peak: 0 },
  { label: "subtle", peak: 3 },
  { label: "strong", peak: 6 },
  { label: "heavy", peak: 12 },
] as const;

/**
 * The velocity at which the blur reaches the chosen peak, in px per 60Hz frame:
 * the speed the nav is still doing at half of the drawer's 900ms travel. Above
 * it the blur stays at the peak, below it the blur tapers with the motion, so
 * every peak from 0.5 to 30 is actually reached on a normal open and close.
 */
const REFERENCE_SPEED = 22;

/** One 60Hz frame: velocities are normalised to it so 120Hz screens match. */
const FRAME_MS = 1000 / 60;

/**
 * How long after the handed duration the loop gives up by itself. The flight
 * clearing the blur is the normal path; this only covers a flight that never
 * settles (a paused frame loop, an animation stopped with no successor).
 */
const IDLE_SLACK_MS = 250;

const STORAGE_KEY = "nav-mb-peak";

function clampPeak(value: number): number {
  // Tenths: the slider moves in 0.5 steps, typing can be finer than that.
  return Math.min(MAX_PEAK, Math.max(MIN_PEAK, Math.round(value * 10) / 10));
}

function parsePeak(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;

  const preset = PRESETS.find((entry) => entry.label === raw);
  if (preset) return preset.peak;

  const value = Number(raw);
  return Number.isFinite(value) ? clampPeak(value) : null;
}

/**
 * The query string and storage are read once and kept: opening a drawer
 * rewrites the URL to the study, and the strength must survive that.
 * Both are optional, so failures fall back to the default rather than throwing.
 */
let fromQuery: number | null | undefined;
let fromStorage: number | null | undefined;
let toggleQuery: boolean | undefined;

function queryPeak(): number | null {
  if (typeof window === "undefined") return null;

  if (fromQuery === undefined) {
    fromQuery = parsePeak(
      new URLSearchParams(window.location.search).get("mb"),
    );
  }

  return fromQuery;
}

function storedPeak(): number | null {
  if (typeof window === "undefined") return null;

  if (fromStorage === undefined) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const value = raw === null ? Number.NaN : Number(raw);
      fromStorage = Number.isFinite(value) ? clampPeak(value) : null;
    } catch {
      fromStorage = null;
    }
  }

  return fromStorage;
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

/* ------------------------------ peak store ------------------------------ */

/** What the panel last set, over `?mb=` and storage. Cleared only by a reload. */
let override: number | null = null;
const listeners = new Set<() => void>();

export function getNavBlurPeak(): number {
  return override ?? queryPeak() ?? storedPeak() ?? DEFAULT_PEAK;
}

function subscribePeak(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setNavBlurPeak(peak: number): void {
  if (!Number.isFinite(peak)) return;

  const next = clampPeak(peak);
  override = next;

  if (next === 0) {
    // Switching off mid-flight must not leave the filter stuck on.
    endNavBlur();
  }

  // A prototype preference, not app state: never let storage take the panel
  // down with it (private mode, a blocked origin, a full quota).
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Keep the live value; only the memory across reloads is lost.
  }

  listeners.forEach((listener) => listener());
}

/**
 * The peak is live, but the server cannot know `?mb=` or storage: it renders
 * the default and the client corrects on hydration, like use-reduced-motion.
 */
export function useNavBlurPeak(): number {
  return useSyncExternalStore(
    subscribePeak,
    getNavBlurPeak,
    () => DEFAULT_PEAK,
  );
}

/* ------------------------------ the loop ------------------------------ */

let raf = 0;
/** Bumped by every end, so a loop left over from an earlier flight dies. */
let token = 0;
let tracked: HTMLElement | null = null;
let gaussian: SVGFEGaussianBlurElement | null = null;

/**
 * Drops the blur at once. Called when the flight settles, when the dock
 * unmounts, when the peak goes to zero, and by the loop's own deadline: a quick
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
 * The filter region, in the element's own user space, padded by the blur's own
 * spread: a larger peak needs a taller region or the smear is cut off at the
 * bar's edges. 32px is the floor that keeps the card's shadow inside.
 */
function setRegion(
  size: { width: number; height: number },
  peak: number,
): void {
  const filter = document.getElementById(NAV_BLUR_FILTER_ID);
  if (!filter) return;

  const pad = Math.max(32, Math.ceil(peak * 3.5));

  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("x", String(-pad));
  filter.setAttribute("y", String(-pad));
  filter.setAttribute("width", String(Math.ceil(size.width + pad * 2)));
  filter.setAttribute("height", String(Math.ceil(size.height + pad * 2)));
}

/**
 * Follow `element` for one flight of `durationSeconds` and paint its vertical
 * velocity into the shared filter. A no-op when the peak is zero, reduced
 * motion is on, or the engine is WebKit.
 */
export function beginNavBlur(
  element: HTMLElement,
  durationSeconds: number,
): void {
  if (getNavBlurPeak() <= 0) return;
  if (prefersReducedMotion() || isWebKit()) return;

  const node = gaussianNode();
  if (!node) return;

  // A quick open→close restarts here: the previous loop dies with its token
  // and this one takes the element over from wherever it is right now.
  endNavBlur();
  const mine = token;

  tracked = element;
  gaussian = node;

  // One read for the start position and the region; the filter is applied
  // only after the region is right for this peak, so nothing is clipped.
  const start = element.getBoundingClientRect();
  setRegion(start, getNavBlurPeak());
  element.style.filter = `url(#${NAV_BLUR_FILTER_ID})`;

  let regionPeak = getNavBlurPeak();
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

    const peak = getNavBlurPeak();
    if (peak !== regionPeak) {
      // The slider moved mid-flight: the region has to grow with it.
      regionPeak = peak;
      setRegion(element.getBoundingClientRect(), peak);
    }

    const deviation = peak * Math.min(1, speed / REFERENCE_SPEED);
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
        // Vertical blur only. The real region is written per flight by
        // setRegion(), which grows with the peak; these are the at-rest values.
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

const buttonStyle = {
  padding: "5px 7px",
  borderRadius: 5,
  border: "1px solid rgba(250, 250, 250, 0.18)",
  background: "transparent",
  color: "#fafafa",
  font: "inherit",
  textTransform: "uppercase" as const,
  cursor: "pointer",
};

/**
 * Prototype-only strength panel. Renders only with `?mbtoggle=1` or in dev, and
 * sits above the nav's layer so it stays usable while the drawer is open.
 */
function Toggle() {
  const peak = useNavBlurPeak();
  // The number field keeps the raw text while it is being edited, so typing
  // "7." does not get rewritten to "7" under the caret.
  const [draft, setDraft] = useState<string | null>(null);
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
        display: "grid",
        gap: 7,
        width: "min(312px, calc(100vw - 24px))",
        padding: 8,
        borderRadius: 10,
        border: "1px dashed #f0abfc",
        background: "rgba(24, 24, 27, 0.94)",
        color: "#fafafa",
        font: "500 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.03em",
        pointerEvents: "auto",
      }}
      data-nav-mb-toggle=""
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ opacity: 0.6, marginRight: 2 }}>NAV MB</span>
        {PRESETS.map(({ label, peak: preset }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setDraft(null);
              setNavBlurPeak(preset);
            }}
            aria-pressed={peak === preset}
            style={
              peak === preset
                ? { ...buttonStyle, background: "#f0abfc", color: "#18181b" }
                : buttonStyle
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <label htmlFor="nav-mb-peak">Blur peak</label>
        <output
          htmlFor="nav-mb-peak"
          style={{
            fontVariantNumeric: "tabular-nums",
            opacity: 0.85,
          }}
        >
          {peak.toFixed(1)}px
        </output>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id="nav-mb-peak"
          type="range"
          min={MIN_PEAK}
          max={MAX_PEAK}
          step={0.5}
          value={peak}
          onChange={(event) => setNavBlurPeak(Number(event.target.value))}
          style={{
            flex: 1,
            minWidth: 0,
            height: 18,
            accentColor: "#f0abfc",
            cursor: "pointer",
          }}
        />
        <input
          type="number"
          min={MIN_PEAK}
          max={MAX_PEAK}
          step={0.5}
          inputMode="decimal"
          aria-label="Blur peak, exact value in pixels"
          value={draft ?? peak.toFixed(1)}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            if (raw.trim() !== "") setNavBlurPeak(Number(raw));
          }}
          onBlur={() => setDraft(null)}
          style={{
            width: 60,
            padding: "4px 6px",
            borderRadius: 5,
            border: "1px solid rgba(250, 250, 250, 0.18)",
            background: "rgba(250, 250, 250, 0.06)",
            color: "#fafafa",
            font: "inherit",
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        />
      </div>
    </div>
  );
}

/** The blur layer: its hidden filter, the dev panel, and the cleanup. */
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
