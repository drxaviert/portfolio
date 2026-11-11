"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  applyMode,
  readStoredMode,
  THEME_CHANGE_EVENT,
  writeStoredMode,
} from "@/lib/theme";
import type { Mode, Phase } from "@/lib/theme";

/** Auto re-reads the clock once a minute; a minute boundary is all a phase needs. */
const CLOCK_CHECK_INTERVAL_MS = 60_000;

type ThemeContextValue = {
  mode: Mode;
  phase: Phase;
  setMode: (mode: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODES: Mode[] = ["day", "night", "auto"];
const PHASES: Phase[] = ["dawn", "day", "dusk", "night"];

/** Server render and hydration start from a stable snapshot; the client follows. */
const SERVER_SNAPSHOT = "auto:day";

/**
 * The data attributes on <html> are the single source of truth: the pre-paint
 * script sets them from storage + the clock, and every change here updates them
 * before React re-reads them.
 */
function readSnapshot(): string {
  const { mode, phase } = document.documentElement.dataset;

  return `${MODES.find((value) => value === mode) ?? "auto"}:${
    PHASES.find((value) => value === phase) ?? "day"
  }`;
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
  const [mode, phase] = snapshot.split(":") as [Mode, Phase];
  const modeRef = useRef<Mode | null>(null);

  const setMode = useCallback((next: Mode) => {
    // Remember the choice even when localStorage rejects the write.
    modeRef.current = next;

    applyMode(next);
    writeStoredMode(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  // Auto and day both follow the clock: re-apply on a timer and whenever the
  // tab comes back, so a phase change lands without a reload.
  useEffect(() => {
    const refresh = () => {
      // Dev preview routes pin a phase on <html>; the clock must not undo it.
      if (document.documentElement.dataset.phasePreview === "true") {
        return;
      }

      const before = readSnapshot();

      // Re-apply the mode held in memory, not the stored one: a blocked
      // storage write must not turn a Night/Day choice back into Auto.
      modeRef.current ??= readStoredMode();
      applyMode(modeRef.current);

      if (readSnapshot() !== before) {
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    };

    refresh();

    const interval = window.setInterval(refresh, CLOCK_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const value = useMemo(
    () => ({ mode, phase, setMode }),
    [mode, phase, setMode],
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
