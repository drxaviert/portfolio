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
let closeReader: (() => void) | null = null;

export function registerNavDock(controls: NavDockControls): () => void {
  dock = controls;

  return () => {
    if (dock === controls) dock = null;
  };
}

/** The overlay's close gesture, for the dock that sits outside the panel. */
export function registerReaderClose(close: (() => void) | null): () => void {
  closeReader = close;

  return () => {
    if (closeReader === close) closeReader = null;
  };
}

export function hasReaderClose(): boolean {
  return closeReader !== null;
}

export function requestReaderClose(): void {
  closeReader?.();
}

export function moveNav(to: NavDockState, mode: NavFlightMode): Promise<void> {
  if (!dock) return Promise.resolve();

  return to === "reader" ? dock.toReader(mode) : dock.toHome(mode);
}
