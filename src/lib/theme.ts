export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Reads the persisted theme. Returns null when storage is unavailable or
 * holds anything that is not one of the supported themes.
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persists the theme. Storage can throw (private mode, blocked storage);
 * a failed write must never break the session.
 */
export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Intentionally ignored: the in-memory theme still applies.
  }
}

/** Stored choice wins; otherwise follow the system preference. */
export function resolveTheme(
  stored: Theme | null,
  prefersDark: boolean,
): Theme {
  if (stored) {
    return stored;
  }

  return prefersDark ? "dark" : "light";
}
