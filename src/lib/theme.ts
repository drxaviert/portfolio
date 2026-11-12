export type Mode = "day" | "night" | "auto";

export type Phase = "dawn" | "day" | "dusk" | "night";

/**
 * The stored choice keeps the original key so existing visitors are migrated
 * rather than reset: "light" becomes "day", "dark" becomes "night", and
 * anything missing or unknown becomes "auto".
 */
export const MODE_STORAGE_KEY = "theme";

/** Hour at which each phase starts (local time, 24h clock). */
export const PHASE_STARTS = {
  dawn: 5,
  day: 8,
  dusk: 17,
  night: 20,
} as const;

/**
 * In Day mode the night hours mirror back onto their neighbours rather than
 * staying on dusk: 20–2 reads as day, 2–5 reads as dawn.
 */
const DAY_MIRROR_DAWN_START = 2;

const LEGACY_MODES: Record<string, Mode> = {
  day: "day",
  night: "night",
  auto: "auto",
  light: "day",
  dark: "night",
};

function isMode(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEGACY_MODES, value);
}

/**
 * Phase for an hour of the local clock.
 *
 * - auto: dawn 5–8, day 8–17, dusk 17–20, night 20–5.
 * - day: a light theme that still follows the clock and never shows night;
 *   20–2 mirrors back to day and 2–5 mirrors back to dawn, so every change
 *   lands on a neighbouring phase (02–08 is continuous dawn).
 * - night: always night.
 */
export function phaseForHour(hour: number, mode: Mode = "auto"): Phase {
  const h = ((Math.floor(hour) % 24) + 24) % 24;

  if (mode === "night") {
    return "night";
  }

  if (h >= PHASE_STARTS.dawn && h < PHASE_STARTS.day) {
    return "dawn";
  }

  if (h >= PHASE_STARTS.day && h < PHASE_STARTS.dusk) {
    return "day";
  }

  if (h >= PHASE_STARTS.dusk && h < PHASE_STARTS.night) {
    return "dusk";
  }

  if (mode === "auto") {
    return "night";
  }

  return h >= DAY_MIRROR_DAWN_START && h < PHASE_STARTS.dawn ? "dawn" : "day";
}

/** Phase for a moment in the visitor's local time zone. */
export function phaseFor(date: Date = new Date(), mode: Mode = "auto"): Phase {
  return phaseForHour(date.getHours(), mode);
}

/** Hours where the Auto phase can change. */
const PHASE_BOUNDARY_HOURS = [
  PHASE_STARTS.dawn,
  PHASE_STARTS.day,
  PHASE_STARTS.dusk,
  PHASE_STARTS.night,
];

/** Day mode also mirrors 20–2 back to day, so 2:00 hands day back to dawn. */
const DAY_BOUNDARY_HOURS = [
  DAY_MIRROR_DAWN_START,
  PHASE_STARTS.day,
  PHASE_STARTS.dusk,
  PHASE_STARTS.night,
];

/**
 * Milliseconds until the next phase boundary on the local clock.
 *
 * The boundary is built as a local `Date`, so DST shifts are included instead
 * of adding a fixed number of hours. At an exact boundary the following one is
 * returned. Day mode has its own boundary set because of the 2:00 mirror.
 */
export function msUntilNextPhaseBoundary(
  date: Date = new Date(),
  mode: Mode = "auto",
): number {
  const hours = mode === "day" ? DAY_BOUNDARY_HOURS : PHASE_BOUNDARY_HOURS;

  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const hour of hours) {
      const boundary = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + dayOffset,
        hour,
        0,
        0,
        0,
      );

      if (boundary.getTime() > date.getTime()) {
        return boundary.getTime() - date.getTime();
      }
    }
  }

  // Tomorrow always has a later boundary; kept for exhaustiveness.
  return 0;
}

/** Maps a raw storage value onto a mode, migrating the old light/dark pair. */
export function parseStoredMode(value: unknown): Mode {
  if (typeof value !== "string" || !isMode(value)) {
    return "auto";
  }

  return LEGACY_MODES[value];
}

/**
 * Reads the persisted choice. Storage can throw (private mode, blocked
 * storage); a failed read falls back to Auto.
 */
export function readStoredMode(): Mode {
  try {
    return parseStoredMode(window.localStorage.getItem(MODE_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

/**
 * Persists the choice. Storage can throw; a failed write must never break the
 * session.
 */
export function writeStoredMode(mode: Mode): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Intentionally ignored: the in-memory choice still applies.
  }
}

/**
 * Applies one phase to the document without consulting the clock, deriving
 * `.dark` so anything still keyed off the class follows. Dev previews use this
 * to pin a phase; production code goes through `applyMode`.
 */
export function applyPhase(
  phase: Phase,
  kind: PhaseSwitchKind = "click",
): void {
  const root = document.documentElement;
  const changed = root.dataset.phase !== phase;

  // Mark before writing data-phase: markPhaseSwitch reads the duration token
  // with getComputedStyle, which flushes styles. Doing that after the phase
  // write would commit the new colours with no switch rule, then the rule
  // arrives too late to animate them.
  if (changed) markPhaseSwitch(kind);

  root.dataset.phase = phase;
  root.classList.toggle("dark", phase === "night");
}

/** Event every theme mutation dispatches; ThemeProvider subscribes to it. */
export const THEME_CHANGE_EVENT = "portfolio:theme-change";

/** Click switches use the glow tokens; clock-driven switches the auto tokens. */
export type PhaseSwitchKind = "click" | "auto";

const DEFAULT_PHASE_SWITCH_MS = 400;

/** Colour-like transitions the switch rule starts; used to tell when the fade ended. */
const PHASE_FADE_PROPERTIES = new Set([
  "color",
  "background-color",
  "border-color",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "box-shadow",
]);

let phaseSwitchFrame: number | null = null;
let phaseSwitchFallback: number | null = null;

/** Cancels a pending end-of-switch watch. */
function stopPhaseSwitchWatch(): void {
  if (phaseSwitchFrame !== null) {
    window.cancelAnimationFrame(phaseSwitchFrame);
    phaseSwitchFrame = null;
  }

  if (phaseSwitchFallback !== null) {
    window.clearTimeout(phaseSwitchFallback);
    phaseSwitchFallback = null;
  }
}

/** Reads a `400ms` / `0.4s` duration token; falls back to the default. */
function readPhaseSwitchMs(kind: PhaseSwitchKind): number {
  const token =
    kind === "auto"
      ? "--phase-auto-transition-duration"
      : "--horizon-transition-duration";
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  const match = /^([\d.]+)(ms|s)$/.exec(raw);

  if (!match) return DEFAULT_PHASE_SWITCH_MS;

  const value = Number(match[1]);

  return match[2] === "s" ? value * 1000 : value;
}

/**
 * Marks a phase change on <html> so every theme colour fades as one piece.
 * globals.css only applies the colour transition while data-phase-switching is
 * present, so ordinary hover/press transitions are untouched afterwards.
 *
 * The attribute is removed when the colour transitions have actually finished,
 * not after a wall-clock delay: a throttled, occluded or background page can
 * render its first frame later than the fade duration, and dropping the rule on
 * a timer would cancel the transition before it starts and snap every colour.
 * Engines without the Web Animations API fall back to the timer.
 */
export function markPhaseSwitch(kind: PhaseSwitchKind = "click"): void {
  const root = document.documentElement;
  const duration = readPhaseSwitchMs(kind);

  stopPhaseSwitchWatch();

  if (duration <= 0) {
    delete root.dataset.phaseSwitching;
    return;
  }

  root.dataset.phaseSwitching = kind;

  const remove = () => {
    delete root.dataset.phaseSwitching;
    stopPhaseSwitchWatch();
  };

  if (
    typeof document.getAnimations !== "function" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    phaseSwitchFallback = window.setTimeout(remove, duration + 50);
    return;
  }

  // Hard cap: an unrelated colour transition (repeated hovers) or a
  // never-ending one must not keep the switch rule alive indefinitely.
  phaseSwitchFallback = window.setTimeout(remove, Math.max(duration * 4, 2000));

  const check = () => {
    phaseSwitchFrame = null;

    const running = document.getAnimations().some(
      (animation) =>
        "transitionProperty" in animation &&
        PHASE_FADE_PROPERTIES.has(
          String((animation as CSSTransition).transitionProperty),
        ) &&
        animation.playState === "running",
    );

    if (running) {
      phaseSwitchFrame = window.requestAnimationFrame(check);
      return;
    }

    remove();
  };

  phaseSwitchFrame = window.requestAnimationFrame(check);
}

/**
 * The last mode applied to the document. Storage writes can fail (private
 * mode), so the in-memory choice has to survive on its own.
 */
let activeMode: Mode | null = null;

/** The mode the document follows when no dev preview is pinned. */
export function getActiveMode(): Mode {
  return activeMode ?? readStoredMode();
}

/**
 * Applies a mode to the document: data-mode and data-phase drive the tokens,
 * and `.dark` stays for anything still keyed off the class. Returns the phase.
 */
export function applyMode(
  mode: Mode,
  date: Date = new Date(),
  kind: PhaseSwitchKind = "click",
): Phase {
  const phase = phaseFor(date, mode);
  const root = document.documentElement;
  const changed = root.dataset.phase !== phase;

  // See applyPhase: mark before the colour attributes change so the style
  // flush from reading the duration token cannot commit the new colours first.
  if (changed) markPhaseSwitch(kind);

  activeMode = mode;
  root.dataset.mode = mode;
  root.dataset.phase = phase;
  root.classList.toggle("dark", phase === "night");

  return phase;
}

/**
 * Pins one phase on <html> for a dev preview, ignoring the clock. The mode is
 * derived from the phase so `data-mode` and `.dark` stay consistent, and the
 * theme-change event tells ThemeProvider to re-read the attributes.
 */
export function pinPhase(
  phase: Phase,
  kind: PhaseSwitchKind = "click",
): void {
  const root = document.documentElement;
  const changed = root.dataset.phase !== phase;

  // See applyPhase: mark before the phase attribute changes.
  if (changed) markPhaseSwitch(kind);

  // Remember the mode the pin is about to overwrite so unpin can restore it.
  activeMode ??= readStoredMode();

  root.dataset.phasePreview = "true";
  root.dataset.phase = phase;
  root.dataset.mode = phase === "night" ? "night" : "day";
  root.classList.toggle("dark", phase === "night");

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * Drops the pin and puts the document back on the current mode, not on the
 * phase that happened to be pinned last.
 */
export function unpinPhase(): void {
  delete document.documentElement.dataset.phasePreview;

  applyMode(getActiveMode());

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
