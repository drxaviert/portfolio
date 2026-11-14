export type Mode = "day" | "night" | "auto";

export type Phase = "dawn" | "day" | "dusk" | "night";

/**
 * Day mode either follows the clock ("clock", the historical behaviour) or
 * pins one light phase. Night and Auto ignore it, but the choice is kept so
 * Day comes back to it.
 */
export type DayPhase = "clock" | "dawn" | "day" | "dusk";

export const DAY_PHASES: readonly DayPhase[] = [
  "clock",
  "dawn",
  "day",
  "dusk",
];

/**
 * The stored choice keeps the original key so existing visitors are migrated
 * rather than reset: "light" becomes "day", "dark" becomes "night", and
 * anything missing or unknown becomes "auto".
 */
export const MODE_STORAGE_KEY = "theme";

/** Separate key: the Day-phase choice survives mode changes. */
export const DAY_PHASE_STORAGE_KEY = "theme-day-phase";

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

function isDayPhase(value: string): value is DayPhase {
  return (DAY_PHASES as readonly string[]).includes(value);
}

/**
 * Phase for an hour of the local clock.
 *
 * - auto: dawn 5–8, day 8–17, dusk 17–20, night 20–5.
 * - day: a light theme that still follows the clock and never shows night;
 *   20–2 mirrors back to day and 2–5 mirrors back to dawn, so every change
 *   lands on a neighbouring phase (02–08 is continuous dawn). A pinned
 *   `dayPhase` replaces the clock entirely.
 * - night: always night.
 *
 * Night and Auto ignore `dayPhase`: only Day mode can pin a phase.
 */
export function phaseForHour(
  hour: number,
  mode: Mode = "auto",
  dayPhase: DayPhase = "clock",
): Phase {
  if (mode === "day" && dayPhase !== "clock") {
    return dayPhase;
  }

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
export function phaseFor(
  date: Date = new Date(),
  mode: Mode = "auto",
  dayPhase: DayPhase = "clock",
): Phase {
  return phaseForHour(date.getHours(), mode, dayPhase);
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

/** Maps a raw storage value onto a Day phase; anything unknown is "clock". */
export function parseStoredDayPhase(value: unknown): DayPhase {
  if (typeof value !== "string" || !isDayPhase(value)) {
    return "clock";
  }

  return value;
}

/**
 * Reads the persisted Day-phase pin. A missing value, an unknown value or
 * blocked storage all mean the default: follow the clock.
 */
export function readStoredDayPhase(): DayPhase {
  try {
    return parseStoredDayPhase(
      window.localStorage.getItem(DAY_PHASE_STORAGE_KEY),
    );
  } catch {
    return "clock";
  }
}

/** Persists the Day-phase pin; a failed write must never break the session. */
export function writeStoredDayPhase(dayPhase: DayPhase): void {
  try {
    window.localStorage.setItem(DAY_PHASE_STORAGE_KEY, dayPhase);
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

  commitPhaseSwitch(kind, root.dataset.phase !== phase, () => {
    root.dataset.phase = phase;
    root.classList.toggle("dark", phase === "night");
  });
}

/** Event every theme mutation dispatches; ThemeProvider subscribes to it. */
export const THEME_CHANGE_EVENT = "portfolio:theme-change";

/**
 * True while a theme crossfade is in flight. A view transition paints snapshots
 * of the page, and the live document stops receiving hit tests for its length,
 * so a pointer-leave reported during one is not a real leave: hover feedback
 * should keep its state and let the next real pointer event correct it.
 */
export function isPhaseSwitching(): boolean {
  return document.documentElement.dataset.phaseSwitching !== undefined;
}

/** Click switches use the glow tokens; clock-driven switches the auto tokens. */
export type PhaseSwitchKind = "click" | "auto";

const DEFAULT_PHASE_SWITCH_MS = 400;

/** The part of the View Transitions API this file relies on. */
type PhaseViewTransition = {
  finished: Promise<void>;
};

type DocumentWithViewTransitions = Document & {
  /**
   * The callback runs after the old state has been captured and before the
   * browser snapshots the new one; a returned promise holds the snapshot back
   * until it settles.
   */
  startViewTransition?: (callback: () => Promise<void>) => PhaseViewTransition;
};

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

/** Writes queued for the next flush; a click can queue more than one. */
let pendingWrites: Array<() => void> = [];
let pendingKind: PhaseSwitchKind = "click";
let flushQueued = false;
let switchGeneration = 0;

/**
 * Lets the render the theme event scheduled commit before the browser snapshots
 * the new state. The toggle's selection is React state, so without this the new
 * snapshot would still show the old selection and the pill would jump when the
 * crossfade ended.
 *
 * Deliberately not a frame: `requestAnimationFrame` does not run while a view
 * transition's update callback is pending — the browser is waiting on this
 * promise to start the rendering update — so awaiting a frame here deadlocks
 * until the renderer's starvation timeout. `useSyncExternalStore` flushes its
 * sync-lane render in a microtask, so two hops are enough.
 */
function settleUpdate(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

/**
 * Applies every queued theme write as one crossfade.
 *
 * The browser snapshots the page before and after the change and blends the
 * two images on the compositor, so not one colour property is animated per
 * element: the paint cost of a theme change is two captures, not a full
 * repaint per frame. Every layer — the horizon, the cards, the text, the nav,
 * the toggle — is inside the same snapshot, so they start and finish together
 * by construction.
 *
 * Reduced motion keeps the crossfade (a colour change is not motion) but runs
 * it on the shortened token. Engines without the API, and a zero-length token,
 * switch instantly instead.
 */
function flushPhaseSwitch(): void {
  flushQueued = false;

  const writes = pendingWrites;
  const kind = pendingKind;

  pendingWrites = [];

  const root = document.documentElement;
  const doc = document as DocumentWithViewTransitions;
  const duration = readPhaseSwitchMs(kind);
  const generation = ++switchGeneration;

  const apply = () => {
    for (const write of writes) write();
  };

  const announce = () => {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  if (duration <= 0 || typeof doc.startViewTransition !== "function") {
    apply();
    announce();
    return;
  }

  let transition: PhaseViewTransition;

  try {
    // Marked before the transition starts so the handlers that run on the same
    // click — and anything the crossfade's pointer loss touches — can see it.
    root.dataset.phaseSwitching = kind;

    transition = doc.startViewTransition(() => {
      apply();
      announce();

      return settleUpdate();
    });
  } catch {
    delete root.dataset.phaseSwitching;
    apply();
    announce();
    return;
  }

  const settle = () => {
    // A newer switch owns the attribute and clears it itself.
    if (generation !== switchGeneration) return;

    delete root.dataset.phaseSwitching;
  };

  transition.finished.then(settle, settle);
}

/**
 * Queues one theme write. Writes made in the same task — the Night -> Day
 * phase pick applies the pin and the mode together — share one crossfade
 * instead of starting a second transition that would snap the first.
 *
 * The flush is a microtask so the old snapshot is still captured before the
 * page paints the new colours. Engines without the API get the old synchronous
 * behaviour: write, then announce, in the calling task.
 */
function commitPhaseSwitch(
  kind: PhaseSwitchKind,
  changed: boolean,
  write: () => void,
): void {
  if (!changed) {
    write();
    return;
  }

  if (
    typeof (document as DocumentWithViewTransitions).startViewTransition !==
    "function"
  ) {
    write();
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    return;
  }

  pendingKind = kind;
  pendingWrites.push(write);

  if (flushQueued) return;

  flushQueued = true;
  queueMicrotask(flushPhaseSwitch);
}

/**
 * The last mode applied to the document. Storage writes can fail (private
 * mode), so the in-memory choice has to survive on its own.
 */
let activeMode: Mode | null = null;

/** Same fallback for the Day-phase pin: storage can be unavailable. */
let activeDayPhase: DayPhase | null = null;

/** The mode the document follows when no dev preview is pinned. */
export function getActiveMode(): Mode {
  return activeMode ?? readStoredMode();
}

/** The Day-phase pin the document follows when no dev preview is pinned. */
export function getActiveDayPhase(): DayPhase {
  return activeDayPhase ?? readStoredDayPhase();
}

/**
 * Applies a mode to the document: data-mode and data-phase drive the tokens,
 * and `.dark` stays for anything still keyed off the class. Night and Auto
 * resolve from the clock even when a Day-phase pin is stored; Day applies the
 * pin, or follows the clock when the pin is "clock". Returns the phase.
 */
export function applyMode(
  mode: Mode,
  date: Date = new Date(),
  kind: PhaseSwitchKind = "click",
  dayPhase: DayPhase = getActiveDayPhase(),
): Phase {
  const phase = phaseFor(date, mode, dayPhase);
  const root = document.documentElement;
  const changed =
    root.dataset.phase !== phase ||
    root.dataset.mode !== mode ||
    root.dataset.dayPhase !== dayPhase;

  // Kept in memory straight away: a queued write must not leave the next
  // caller reading the mode this call is replacing.
  activeMode = mode;
  activeDayPhase = dayPhase;

  commitPhaseSwitch(kind, changed, () => {
    root.dataset.mode = mode;
    root.dataset.dayPhase = dayPhase;
    root.dataset.phase = phase;
    root.classList.toggle("dark", phase === "night");
  });

  return phase;
}

/**
 * Chooses the Day-mode phase. The pin is remembered even while Night or Auto
 * is active, so the next Day selection returns to it; the current mode keeps
 * ignoring it until then.
 */
export function applyDayPhase(
  dayPhase: DayPhase,
  date: Date = new Date(),
  kind: PhaseSwitchKind = "click",
): Phase {
  activeDayPhase = dayPhase;
  writeStoredDayPhase(dayPhase);

  // The document is the source of truth for the current mode: a pre-paint
  // script can have set it before this module ever ran.
  const applied = document.documentElement.dataset.mode;

  return applyMode(
    applied === "day" || applied === "night" || applied === "auto"
      ? applied
      : getActiveMode(),
    date,
    kind,
    dayPhase,
  );
}

/**
 * Pins one phase on <html> for a dev preview, ignoring the clock. The mode is
 * derived from the phase so `data-mode` and `.dark` stay consistent.
 */
export function pinPhase(
  phase: Phase,
  kind: PhaseSwitchKind = "click",
): void {
  const root = document.documentElement;

  // Remember the mode the pin is about to overwrite so unpin can restore it.
  activeMode ??= readStoredMode();

  commitPhaseSwitch(kind, root.dataset.phase !== phase, () => {
    root.dataset.phasePreview = "true";
    root.dataset.phase = phase;
    root.dataset.mode = phase === "night" ? "night" : "day";
    root.classList.toggle("dark", phase === "night");
  });
}

/**
 * Drops the pin and puts the document back on the current mode, not on the
 * phase that happened to be pinned last.
 */
export function unpinPhase(): void {
  delete document.documentElement.dataset.phasePreview;

  // applyMode announces the change, including when only the preview flag moved.
  applyMode(getActiveMode());
}
