/**
 * The two motion candidates compared on the live page: `?b1=1` (the card ring
 * grows with a transform instead of animating clip-path) and `?reveal=1` (the
 * drawer content leads the morph by 300ms instead of 120ms).
 *
 * The URL is the source of truth on first read. From then on the pill writes
 * this store, which applies the flags to <html> for CSS and keeps the address
 * bar in step, so a reload keeps the chosen variant. Both default to off, which
 * is the shipped behaviour.
 */

export type MotionAbFlag = "b1" | "reveal";
export type MotionAbFlags = Record<MotionAbFlag, boolean>;

export const MOTION_AB_DEFAULT: MotionAbFlags = { b1: false, reveal: false };

const PARAM: Record<MotionAbFlag, string> = { b1: "b1", reveal: "reveal" };
const FLAGS = Object.keys(PARAM) as MotionAbFlag[];

type MotionAbState = {
  flags: MotionAbFlags;
  /** The URL named a candidate at load: the pill's production gate. */
  fromUrl: boolean;
};

let state: MotionAbState | null = null;

/** The pill subscribes; nothing else changes the flags. */
const listeners = new Set<() => void>();

export function subscribeMotionAb(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function readUrl(): MotionAbState {
  if (typeof window === "undefined") {
    return { flags: MOTION_AB_DEFAULT, fromUrl: false };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    flags: {
      b1: params.get(PARAM.b1) === "1",
      reveal: params.get(PARAM.reveal) === "1",
    },
    fromUrl: params.has(PARAM.b1) || params.has(PARAM.reveal),
  };
}

/** Writes the flags to <html>; ring-hover.css keys its candidate block on it. */
function paint(flags: MotionAbFlags) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  if (flags.b1) root.dataset.b1 = "";
  else delete root.dataset.b1;

  // Named apart from the reader's own `data-reveal` (expand-shell.tsx).
  if (flags.reveal) root.dataset.motionReveal = "";
  else delete root.dataset.motionReveal;
}

/** The current flags. Reads the URL once, on the client only. */
export function motionAbFlags(): MotionAbFlags {
  state ??= readUrl();

  return state.flags;
}

/** Whether the URL asked for a candidate at load (the pill's production gate). */
export function motionAbFromUrl(): boolean {
  state ??= readUrl();

  return state.fromUrl;
}

/** Applies the flags to the document; the pill calls this on mount. */
export function applyMotionAb(): MotionAbFlags {
  const flags = motionAbFlags();

  paint(flags);

  return flags;
}

export function setMotionAbFlag(flag: MotionAbFlag, on: boolean): MotionAbFlags {
  const flags = { ...motionAbFlags(), [flag]: on };

  state = { flags, fromUrl: state?.fromUrl ?? false };
  paint(flags);

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);

    for (const key of FLAGS) {
      if (flags[key]) url.searchParams.set(PARAM[key], "1");
      else url.searchParams.delete(PARAM[key]);
    }

    // Keep the router's own state (the drawer writes `workOverlay` here).
    window.history.replaceState(window.history.state, "", url);
  }

  for (const listener of listeners) listener();

  return flags;
}

export function toggleMotionAbFlag(flag: MotionAbFlag): MotionAbFlags {
  return setMotionAbFlag(flag, !motionAbFlags()[flag]);
}
