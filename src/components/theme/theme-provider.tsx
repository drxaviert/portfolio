"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  applyDayPhase,
  applyMode,
  DAY_PHASES,
  getActiveDayPhase,
  msUntilNextPhaseBoundary,
  readStoredMode,
  THEME_CHANGE_EVENT,
  writeStoredMode,
} from "@/lib/theme";
import type { DayPhase, Mode, Phase } from "@/lib/theme";

/** Fire just after a boundary so the new phase is definitely current. */
const PHASE_BOUNDARY_BUFFER_MS = 250;

/** Cap one timer so sleep and clock drift are re-checked at least every 6h. */
const MAX_PHASE_TIMER_MS = 6 * 60 * 60 * 1000;

type ThemeContextValue = {
  mode: Mode;
  phase: Phase;
  dayPhase: DayPhase;
  setMode: (mode: Mode) => void;
  setDayPhase: (dayPhase: DayPhase) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODES: Mode[] = ["day", "night", "auto"];
const PHASES: Phase[] = ["dawn", "day", "dusk", "night"];

/** Server render and hydration start from a stable snapshot; the client follows. */
const SERVER_SNAPSHOT = "auto:day:clock";

/**
 * The data attributes on <html> are the single source of truth: the pre-paint
 * script sets them from storage + the clock, and every change here updates them
 * before React re-reads them.
 */
function readSnapshot(): string {
  const { mode, phase, dayPhase } = document.documentElement.dataset;

  return `${MODES.find((value) => value === mode) ?? "auto"}:${
    PHASES.find((value) => value === phase) ?? "day"
  }:${DAY_PHASES.find((value) => value === dayPhase) ?? "clock"}`;
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeToTheme,
    readSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [mode, phase, dayPhase] = snapshot.split(":") as [
    Mode,
    Phase,
    DayPhase,
  ];

  const setMode = useCallback((next: Mode) => {
    applyMode(next);
    writeStoredMode(next);
    // The theme-change listener below reschedules the boundary timer; it is the
    // single path for mode changes, dev previews and other theme mutations, so
    // a mode change never schedules twice.
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const setDayPhase = useCallback((next: DayPhase) => {
    applyDayPhase(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  // Auto and Day follow the clock (see phaseFor). One timer targets the next
  // phase boundary instead of polling every minute; visibility and focus
  // re-evaluate after sleep or a throttled timer.
  useEffect(() => {
    let timer: number | null = null;

    function clearTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function currentMode(): Mode {
      const value = document.documentElement.dataset.mode;

      return value === "day" || value === "night" || value === "auto"
        ? value
        : readStoredMode();
    }

    function refresh() {
      // Timers are suspended in hidden tabs; skip the work and the timer.
      if (document.hidden) {
        clearTimer();
        return;
      }

      // Dev preview routes pin a phase on <html>; the clock must not undo it.
      if (document.documentElement.dataset.phasePreview === "true") {
        clearTimer();
        return;
      }

      const before = readSnapshot();

      applyMode(currentMode(), new Date(), "auto");

      if (readSnapshot() !== before) {
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }

      schedule();
    }

    function schedule() {
      clearTimer();

      if (document.hidden) return;
      if (document.documentElement.dataset.phasePreview === "true") return;

      const nextMode = currentMode();

      // Night never leaves night; only Auto and Day follow the clock. A pinned
      // Day phase has no boundary either: it stays put until the pin changes.
      if (nextMode === "night") return;
      if (nextMode === "day" && getActiveDayPhase() !== "clock") return;

      const delay = Math.min(
        msUntilNextPhaseBoundary(new Date(), nextMode) +
          PHASE_BOUNDARY_BUFFER_MS,
        MAX_PHASE_TIMER_MS,
      );

      timer = window.setTimeout(() => {
        timer = null;
        refresh();
      }, delay);
    }

    const onVisibilityChange = () => {
      if (document.hidden) clearTimer();
      else refresh();
    };
    const onFocus = () => refresh();
    const onThemeChange = () => schedule();

    refresh();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    };
  }, []);

  const value = useMemo(
    () => ({ mode, phase, dayPhase, setMode, setDayPhase }),
    [mode, phase, dayPhase, setMode, setDayPhase],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
