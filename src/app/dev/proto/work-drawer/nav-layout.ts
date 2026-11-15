import type { NavMode, Rect } from "./types";

/**
 * Geometry for the expand reader and the nav treatment around it.
 *
 * The nav copy always keeps the homepage nav's measured left, width and height;
 * only its top changes per mode. Nothing wraps or restyles it, so the live
 * HomeNav is pixel-identical to the one on /.
 *
 * - stay:   above the reader, at the page nav's slot (docked to the bottom
 *           edge only when that slot is partly off-screen)
 * - float:  the same bar docked over the bottom of the full-height reader
 * - header: the same bar at the top of the reader, with the close in its own
 *           row above so the nav's box and contents are untouched
 */

export type ReaderLayout = {
  panel: Rect;
  nav: Rect;
  navFrom: Rect;
  headerBar: Rect | null;
  headerClose: Rect | null;
  /** Extra scroll-column padding so content clears the dock / header. */
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
  const navWidth = navFrom.width;
  const navHeight = navFrom.height || NAV_HEIGHT;
  const full: Rect = {
    left: inset,
    top: inset,
    width: vw - inset * 2,
    height: vh - inset * 2,
  };

  if (mode === "stay") {
    // Keep the exact homepage box. Only when the page nav is partly below the
    // viewport (375, and 768 with a scrollbar) does it move to the bottom edge.
    const navTop = fitsViewport(navFrom, vw, vh)
      ? navFrom.top
      : vh - 12 - navHeight;
    const top = mobile ? 8 : 16;

    return {
      panel: {
        left: navFrom.left,
        top,
        width: navWidth,
        height: Math.max(280, navTop - GAP - top),
      },
      nav: {
        left: navFrom.left,
        top: navTop,
        width: navWidth,
        height: navHeight,
      },
      navFrom,
      headerBar: null,
      headerClose: null,
      padTop: 0,
      padBottom: 0,
    };
  }

  if (mode === "float") {
    const margin = mobile ? 12 : 24;

    return {
      panel: full,
      nav: {
        left: navFrom.left,
        top: vh - margin - navHeight,
        width: navWidth,
        height: navHeight,
      },
      navFrom,
      headerBar: null,
      headerClose: null,
      padTop: 0,
      padBottom: navHeight + margin + 32,
    };
  }

  // header: close row above, then the untouched nav bar.
  const closeSize = mobile ? 32 : 36;
  const edge = mobile ? 8 : 12;
  const closeTop = full.top + edge;
  const navTop = closeTop + closeSize + 8;
  const bar: Rect = {
    left: full.left,
    top: full.top,
    width: full.width,
    height: navTop + navHeight - full.top,
  };

  return {
    panel: full,
    nav: {
      left: navFrom.left,
      top: navTop,
      width: navWidth,
      height: navHeight,
    },
    navFrom,
    headerBar: bar,
    headerClose: {
      left: full.left + full.width - edge - closeSize,
      top: closeTop,
      width: closeSize,
      height: closeSize,
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
