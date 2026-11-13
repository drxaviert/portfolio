"use client";

import { useEffect } from "react";
import {
  cycleDayRowVariant,
  DAY_ROW_VARIANTS,
  setDayRowVariant,
  useDayRowVariant,
} from "@/components/theme/day-row-variant";

/**
 * Dev-only switch for the three ways a keyboard focus on Day can open the
 * phase row. It renders only in development (see app/layout.tsx); the choice is
 * remembered in localStorage and `K` cycles it when focus is not in a field.
 */
export function DayRowVariantPanel() {
  const variant = useDayRowVariant();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "k" && event.key !== "K") {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      cycleDayRowVariant();
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      role="group"
      aria-label="Day row keyboard"
      className="fixed bottom-3 left-[62px] z-[60] flex items-center gap-2 rounded-lg bg-surface-container-low p-2 text-xs text-on-surface shadow-card"
    >
      <span className="font-medium">Day row</span>

      <div
        role="group"
        aria-label="Day row keyboard variant"
        className="flex items-center rounded-md bg-toggle-track p-0.5"
      >
        {DAY_ROW_VARIANTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={variant === option.value}
            onClick={() => setDayRowVariant(option.value)}
            className={[
              "h-5 rounded-[6px] px-1.5 text-[11px] leading-none outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              variant === option.value
                ? "bg-toggle-selected text-on-surface"
                : "text-on-surface-variant",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="text-[10px] text-on-surface-variant">K</span>
    </div>
  );
}
