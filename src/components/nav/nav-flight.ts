/**
 * The bridge between the reader (inside the `@modal` slot) and the one nav
 * (inside the root layout). Both are client components but sit in different
 * React trees, so the shell asks for a move here and the dock performs it.
 *
 * Imperative by design, like `overlay-exit.ts`: a flight is measured from the
 * live rect at the moment it starts and never rendered through state, so no
 * component re-renders per frame.
 */

export type NavDockState = "home" | "reader";

/**
 * Motion's `animate`, lent to the dock by the reader. The dock is in the root
 * layout, so importing motion there would put the library in every route's
 * first-load JS — including the home page, which never animates. The reader
 * already imports it (use-morph.ts) and registers it here; a flight only ever
 * runs while the reader is mounting or leaving, so it is always present by then.
 */
export type DockAnimate = typeof import("motion/react").animate;

let dockAnimate: DockAnimate | null = null;

export function registerDockAnimate(animate: DockAnimate | null): void {
  dockAnimate = animate;
}

export function getDockAnimate(): DockAnimate | null {
  return dockAnimate;
}

/** The one nav's root, and the empty slot the home layout reserves for it. */
export const DOCK_SELECTOR = "[data-nav-dock]";
export const SLOT_SELECTOR = "[data-nav-slot]";

/** `flip` is the transform flight; `fade` is the reduced-motion / no-card path. */
export type NavFlightMode = "flip" | "fade";

type NavDockControls = {
  toReader: (mode: NavFlightMode) => Promise<void>;
  toHome: (mode: NavFlightMode) => Promise<void>;
};

let dock: NavDockControls | null = null;
/**
 * Whoever owns the close right now, newest first. The overlay registers over a
 * direct load's page reader and, when it lets go, the page reader's own close
 * has to be reachable again.
 */
const closeReaders: (() => void)[] = [];

export function registerNavDock(controls: NavDockControls): () => void {
  dock = controls;

  return () => {
    if (dock === controls) dock = null;
  };
}

/** The reader's close gesture, for the dock that sits outside the panel. */
export function registerReaderClose(
  close: (() => void) | null,
): () => void {
  if (!close) {
    closeReaders.length = 0;
    return () => undefined;
  }

  closeReaders.push(close);

  return () => {
    const index = closeReaders.lastIndexOf(close);
    if (index !== -1) closeReaders.splice(index, 1);
  };
}

export function hasReaderClose(): boolean {
  return closeReaders.length > 0;
}

export function requestReaderClose(): void {
  closeReaders[closeReaders.length - 1]?.();
}

export function moveNav(to: NavDockState, mode: NavFlightMode): Promise<void> {
  if (!dock) return Promise.resolve();

  return to === "reader" ? dock.toReader(mode) : dock.toHome(mode);
}
