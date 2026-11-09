"use client";

import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label =
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button type="button" onClick={toggleTheme} aria-label={label}>
      {label}
    </button>
  );
}
