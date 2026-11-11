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
export function applyPhase(phase: Phase): void {
  const root = document.documentElement;

  root.dataset.phase = phase;
  root.classList.toggle("dark", phase === "night");
}

/** Event every theme mutation dispatches; ThemeProvider subscribes to it. */
export const THEME_CHANGE_EVENT = "portfolio:theme-change";

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
export function applyMode(mode: Mode, date: Date = new Date()): Phase {
  const phase = phaseFor(date, mode);
  const root = document.documentElement;

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
export function pinPhase(phase: Phase): void {
  const root = document.documentElement;

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
