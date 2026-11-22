"use client";

import { useSyncExternalStore } from "react";
import { useBackMenuVariant } from "./use-back-menu-variant";
import {
  BACK_MENU_VARIANTS,
  backMenuSwitchVisible,
  setBackMenuVariant,
} from "./back-menu-variant";
import "./back-menu.css";

/** Visibility is static for the page; no store to subscribe to. */
function subscribeToNothing() {
  return () => undefined;
}

/**
 * The prototype's live switch. It is dev-only, or shown when `?bm=` asked for a
 * variant, so the review URLs are self-explanatory without shipping the pill.
 */
export function BackMenuDevSwitch() {
  const variant = useBackMenuVariant();
  const visible = useSyncExternalStore(
    subscribeToNothing,
    backMenuSwitchVisible,
    () => false,
  );

  if (!visible) return null;

  return (
    <div className="bm-dev" role="group" aria-label="Back menu prototype">
      <span className="bm-dev-label">Back menu</span>
      {BACK_MENU_VARIANTS.map((option) => (
        <button
          key={option}
          type="button"
          className="bm-dev-option"
          aria-pressed={option === variant}
          onClick={() => setBackMenuVariant(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
