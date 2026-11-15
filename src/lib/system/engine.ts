import type { GlideSpring } from "@/components/home/glide-spring";
import { getActivePhase } from "@/lib/theme";
import { derive, phaseAtTod } from "@/lib/system/derive";
import type { TokenMap } from "@/lib/system/derive";
import { clampParams, DEFAULT_PARAMS } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

export type SystemEngine = {
  /** Schedules one write on the next frame; calls in one frame coalesce. */
  set(params: Params): void;
  get(): Params;
  /** Called once per frame after the write, never synchronously from set(). */
  subscribe(listener: (tokens: TokenMap, params: Params) => void): () => void;
  /** Time-scales a spring for the current motion speed (reduced motion wins). */
  spring(base: GlideSpring): GlideSpring;
  /** Cancels pending work and removes everything this engine wrote. */
  dispose(): void;
};

/** Marks the element the engine currently owns while it is live. */
export const SYSTEM_OWNED_ATTR = "data-system-engine";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createSystemEngine(
  root: HTMLElement = document.documentElement,
): SystemEngine {
  // Everything dispose needs to put the element back exactly as it was.
  const originalPhase = root.getAttribute("data-phase");
  const originalHadDark = root.classList.contains("dark");
  const originalStyle = root.getAttribute("style");
  const originalColorScheme = root.style.getPropertyValue("color-scheme");
  const originalColorSchemePriority =
    root.style.getPropertyPriority("color-scheme");

  let current: Params = { ...DEFAULT_PARAMS };
  let frame: number | null = null;
  let disposed = false;

  /** Every custom property this engine has written, for exact cleanup. */
  const written = new Set<string>();
  /** The last value written for each property, so unchanged frames skip it. */
  const lastValues = new Map<string, string>();
  const listeners = new Set<(tokens: TokenMap, params: Params) => void>();

  const write = (): void => {
    // Reduced motion wins at the engine boundary: keep the visitor's speed
    // setting in `params`, but never emit a scaled duration.
    const effective = prefersReducedMotion()
      ? { ...current, speed: 1 }
      : current;
    const tokens = derive(effective, effective.tod);

    for (const name of written) {
      if (!(name in tokens)) {
        root.style.removeProperty(name);
        written.delete(name);
        lastValues.delete(name);
      }
    }

    // A parameter drag changes a subset of the map: about 60 of 209 tokens for
    // one hue step. Writing only those keeps the style invalidation (and the
    // document-wide recalc it causes) proportional to what actually moved.
    for (const [name, value] of Object.entries(tokens)) {
      if (lastValues.get(name) === value) continue;

      root.style.setProperty(name, value);
      written.add(name);
      lastValues.set(name, value);
    }

    const phase = phaseAtTod(current.tod);

    // Attributes are compared against the DOM, not the previous engine write:
    // the theme can move root attributes while this page is mounted.
    if (root.getAttribute("data-phase") !== phase) {
      root.setAttribute("data-phase", phase);
    }

    const colorScheme = phase === "night" ? "dark" : "light";

    if (root.style.getPropertyValue("color-scheme") !== colorScheme) {
      root.style.setProperty("color-scheme", colorScheme);
    }

    const dark = phase === "night";

    if (root.classList.contains("dark") !== dark) {
      root.classList.toggle("dark", dark);
    }

    for (const listener of listeners) listener(tokens, current);
  };

  const requestFrame = (): void => {
    if (disposed || frame !== null) return;

    frame = window.requestAnimationFrame(() => {
      frame = null;

      if (!disposed) write();
    });
  };

  root.setAttribute(SYSTEM_OWNED_ATTR, "true");

  return {
    set(params) {
      if (disposed) return;

      current = clampParams(params);
      requestFrame();
    },

    get() {
      return { ...current };
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    spring(base) {
      if (prefersReducedMotion()) return base;

      // Speed multiplies how fast motion runs, so time-scaling by 1/s means
      // stiffness scales by s². The stored model keeps `dampingRatio` (a
      // ratio), which is already scale-invariant, so it stays put.
      const speed = clampParams(current).speed;

      return {
        stiffness: base.stiffness * speed * speed,
        dampingRatio: base.dampingRatio,
      };
    },

    dispose() {
      if (disposed) return;

      disposed = true;

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }

      listeners.clear();

      for (const name of written) root.style.removeProperty(name);

      written.clear();

      root.style.removeProperty("color-scheme");

      if (originalColorScheme !== "") {
        root.style.setProperty(
          "color-scheme",
          originalColorScheme,
          originalColorSchemePriority,
        );
      }

      // Only drop the style attribute if this engine created it; if the page
      // had inline styles before, leave them untouched.
      if (originalStyle === null && root.style.length === 0) {
        root.removeAttribute("style");
      }

      root.removeAttribute(SYSTEM_OWNED_ATTR);

      if (root === document.documentElement) {
        // The site theme can move while the page is mounted (the toggle writes
        // data-mode and its own phase), so restore the phase the site is on
        // now rather than the snapshot captured before the engine existed.
        // theme.ts owns the mode/pin logic; reusing its getters keeps this in
        // step with the clock and any pinned Day phase.
        const livePhase = getActivePhase();

        root.setAttribute("data-phase", livePhase);
        root.classList.toggle("dark", livePhase === "night");
      } else {
        if (originalPhase === null) root.removeAttribute("data-phase");
        else root.setAttribute("data-phase", originalPhase);

        root.classList.toggle("dark", originalHadDark);
      }
    },
  };
}
