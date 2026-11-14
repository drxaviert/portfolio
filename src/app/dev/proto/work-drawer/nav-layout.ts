import type { NavMode, Rect } from "./types";

/**
 * Geometry for the expand reader and the nav treatment around it.
 *
 * A "stay" reader stops above the real nav (same column, 12px gap); "float"
 * and "header" let the reader take the viewport and carry a live copy of the
 * nav to the bottom pill / top bar. The nav's start box is the real HomeNav's
 * box, measured before the reader opens.
 */

export type ReaderLayout = {
  panel: Rect;
  nav: Rect;
  navFrom: Rect;
  headerBar: Rect | null;
  headerClose: Rect | null;
  /** Extra scroll-column padding so content clears the pill / header. */
  padTop: number;
  padBottom: number;
};

const NAV_HEIGHT = 64;
const GAP = 12;

function fallbackFrom(vw: number, vh: number): Rect {
  return {
    left: 16,
    top: vh - NAV_HEIGHT - 24,
    width: Math.max(0, vw - 32),
    height: NAV_HEIGHT,
  };
}

function fitsViewport(rect: Rect, vw: number, vh: number): boolean {
  return (
    rect.width > 0 &&
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.left + rect.width <= vw &&
    rect.top + rect.height <= vh
  );
}

export function computeReaderLayout(
  mode: NavMode,
  homeNav: Rect | null,
  vw: number,
  vh: number,
): ReaderLayout {
  const mobile = vw < 768;
  const inset = mobile ? 0 : 16;
  const navFrom = homeNav ?? fallbackFrom(vw, vh);
  const full: Rect = {
    left: inset,
    top: inset,
    width: vw - inset * 2,
    height: vh - inset * 2,
  };

  if (mode === "stay") {
    // If the page's nav is off-screen (375), dock it to the bottom edge so it
    // is still visible; the reader then sits in the frame above it.
    const slot = fitsViewport(navFrom, vw, vh)
      ? navFrom
      : {
          left: 16,
          top: vh - 12 - NAV_HEIGHT,
          width: Math.max(0, vw - 32),
          height: NAV_HEIGHT,
        };
    const top = mobile ? 8 : 16;

    return {
      panel: {
        left: slot.left,
        top,
        width: slot.width,
        height: Math.max(280, slot.top - GAP - top),
      },
      nav: slot,
      navFrom,
      headerBar: null,
      headerClose: null,
      padTop: 0,
      padBottom: 0,
    };
  }

  if (mode === "float") {
    const width = Math.min(640, vw - 32);
    const margin = mobile ? 12 : 24;

    return {
      panel: full,
      nav: {
        left: (vw - width) / 2,
        top: vh - margin - NAV_HEIGHT,
        width,
        height: NAV_HEIGHT,
      },
      navFrom,
      headerBar: null,
      headerClose: null,
      padTop: 0,
      padBottom: 64,
    };
  }

  const pad = mobile ? 4 : 8;
  const close = mobile ? 32 : 36;
  const gap = mobile ? 6 : 8;
  const bar: Rect = {
    left: full.left,
    top: full.top,
    width: full.width,
    height: pad * 2 + NAV_HEIGHT,
  };
  const nav: Rect = {
    left: bar.left + pad,
    top: bar.top + pad,
    width: Math.max(0, bar.width - pad * 2 - close - gap),
    height: NAV_HEIGHT,
  };

  return {
    panel: full,
    nav,
    navFrom,
    headerBar: bar,
    headerClose: {
      left: nav.left + nav.width + gap,
      top: bar.top + pad + (NAV_HEIGHT - close) / 2,
      width: close,
      height: close,
    },
    padTop: bar.height + 12,
    padBottom: 0,
  };
}

/** The real nav in the page behind, in viewport coordinates. */
export function measureHomeNav(): Rect | null {
  const nav = document.querySelector<HTMLElement>(".wd-home nav[aria-label]");

  if (!nav) return null;

  const rect = nav.getBoundingClientRect();

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
