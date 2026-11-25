/**
 * The Human Contact route transition, taken from the Motion & Stills canvas
 * rather than invented here: open on the 1s glide, close on the 600ms shrink,
 * both power3.inOut. The case study around the tile leaves on the open's 900ms
 * sibling fade; the study returns with the shrink and ends on the same frame.
 *
 * The numbers live in src/components/canvas/transition.ts. This module only
 * names them for the route and writes them into the custom properties that
 * globals.css reads, so there is no second set of magic durations in CSS.
 */
import { POWER3_IN_OUT_EASE, TRANSITION } from "@/components/canvas/transition";

export const HUMAN_CONTACT_OPEN = "human-contact-open";
export const HUMAN_CONTACT_CLOSE = "human-contact-close";

/** The live page carries this name; the case-study embed stays in the root. */
export const HUMAN_CONTACT_VIEW_TRANSITION = "human-contact";

export const HUMAN_CONTACT_MOTION = {
  openMs: TRANSITION.glideMs,
  closeMs: TRANSITION.closeShrinkMs,
  pageFadeMs: TRANSITION.fadeOutMs,
  ease: POWER3_IN_OUT_EASE,
} as const;

export const HUMAN_CONTACT_MOTION_CSS = `:root {
  --human-contact-open-duration: ${HUMAN_CONTACT_MOTION.openMs}ms;
  --human-contact-close-duration: ${HUMAN_CONTACT_MOTION.closeMs}ms;
  --human-contact-page-fade-duration: ${HUMAN_CONTACT_MOTION.pageFadeMs}ms;
  --human-contact-ease: ${HUMAN_CONTACT_MOTION.ease};
}`;

export type HumanContactBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** The tile rect is the only cross-route fact; keep it in the tab. */
const BOX_STORAGE_KEY = "human-contact:tile";
const RETURN_STORAGE_KEY = "human-contact:return";

/**
 * The study scrolls inside the drawer, not the window, so the browser cannot
 * restore it for us. The return flag tells the remounted embed to line itself
 * back up with the stored viewport rect before the close snapshot is taken.
 */
export function markHumanContactReturn(): void {
  try {
    window.sessionStorage.setItem(RETURN_STORAGE_KEY, "1");
  } catch {
    // Private modes can refuse storage; the page then lands at the top.
  }
}

export function consumeHumanContactReturn(): boolean {
  try {
    const returning = window.sessionStorage.getItem(RETURN_STORAGE_KEY) === "1";
    window.sessionStorage.removeItem(RETURN_STORAGE_KEY);
    return returning;
  } catch {
    return false;
  }
}

/** The nearest element that actually scrolls the study (the drawer reader). */
export function humanContactScrollParent(
  element: HTMLElement | null,
): HTMLElement | null {
  let parent = element?.parentElement ?? null;

  while (parent && parent !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

export function rememberHumanContactBox(box: HumanContactBox): void {
  try {
    window.sessionStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(box));
  } catch {
    // Private modes can refuse storage; the live page then lands directly.
  }
}

export function readHumanContactBox(): HumanContactBox | null {
  try {
    const raw = window.sessionStorage.getItem(BOX_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const box = parsed as Partial<HumanContactBox>;
    const values = [box.left, box.top, box.width, box.height];

    if (
      values.some(
        (value) => typeof value !== "number" || !Number.isFinite(value),
      )
    ) {
      return null;
    }

    if (box.width! <= 0 || box.height! <= 0) return null;

    return {
      left: box.left!,
      top: box.top!,
      width: box.width!,
      height: box.height!,
    };
  } catch {
    return null;
  }
}

type TileTransform = {
  scale: number;
  x: number;
  y: number;
  clipX: number;
  clipY: number;
};

/**
 * Map the full-viewport live page onto the embed rect the way the canvas
 * covers a tile: scale to cover, centre the crop. `x`/`y` position the scaled
 * snapshot; the clip insets crop the extra axis in the snapshot's own box.
 */
export function humanContactTileTransform(
  box: HumanContactBox,
  viewportWidth: number,
  viewportHeight: number,
): TileTransform {
  const width = Math.max(1, Math.min(box.width, viewportWidth));
  const height = Math.max(1, Math.min(box.height, viewportHeight));
  const left = Math.min(Math.max(box.left, 0), viewportWidth - width);
  const top = Math.min(Math.max(box.top, 0), viewportHeight - height);
  const scale = Math.max(width / viewportWidth, height / viewportHeight);

  return {
    scale,
    x: left - (viewportWidth * scale - width) / 2,
    y: top - (viewportHeight * scale - height) / 2,
    clipX: (viewportWidth - width / scale) / 2,
    clipY: (viewportHeight - height / scale) / 2,
  };
}

/** Write the tile geometry where the CSS keyframes read it. */
export function applyHumanContactTileVars(
  box: HumanContactBox | null,
): boolean {
  if (!box) return false;

  const transform = humanContactTileTransform(
    box,
    window.innerWidth,
    window.innerHeight,
  );
  const root = document.documentElement;

  root.style.setProperty("--human-contact-tile-x", `${transform.x}px`);
  root.style.setProperty("--human-contact-tile-y", `${transform.y}px`);
  root.style.setProperty("--human-contact-tile-scale", String(transform.scale));
  root.style.setProperty("--human-contact-tile-clip-x", `${transform.clipX}px`);
  root.style.setProperty("--human-contact-tile-clip-y", `${transform.clipY}px`);

  return true;
}

/**
 * The root snapshots need direction-aware CSS. `onEnter`/`onExit` run once per
 * transition; the count keeps the attribute until the cleanup.
 */
let activeRuns = 0;

export function markHumanContactDirection(
  direction: typeof HUMAN_CONTACT_OPEN | typeof HUMAN_CONTACT_CLOSE,
): () => void {
  activeRuns += 1;
  document.documentElement.setAttribute(
    "data-human-contact-transition",
    direction === HUMAN_CONTACT_OPEN ? "open" : "close",
  );

  return () => {
    activeRuns = Math.max(0, activeRuns - 1);

    if (activeRuns === 0) {
      document.documentElement.removeAttribute("data-human-contact-transition");
    }
  };
}
