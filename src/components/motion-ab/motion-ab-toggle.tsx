"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  MOTION_AB_DEFAULT,
  applyMotionAb,
  motionAbFlags,
  motionAbFromUrl,
  subscribeMotionAb,
  toggleMotionAbFlag,
} from "@/lib/motion-ab";
import type { MotionAbFlag } from "@/lib/motion-ab";
import "./motion-ab-toggle.css";

const OPTIONS: { flag: MotionAbFlag; label: string; title: string }[] = [
  {
    flag: "b1",
    label: "B1 ring",
    title: "Card hover ring: transform scale instead of animating clip-path",
  },
  {
    flag: "reveal",
    label: "R reveal",
    title: "Drawer content: reveal leads the morph by 300ms instead of 120ms",
  },
];

/* Stable snapshots for the "has the client taken over yet" read. */
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const serverFlags = () => MOTION_AB_DEFAULT;

/**
 * The dev pill that flips the two candidates on the real page: fixed bottom
 * left, `?b1=1` / `?reveal=1` behind it. Development always shows it; a
 * production build shows it only when the URL asked for a variant, so the
 * shipped page stays untouched.
 *
 * Nothing renders until hydration: the flags come from `location` and the
 * document, neither of which exists while prerendering, and one frame later is
 * the only way to avoid a hydration mismatch.
 */
export function MotionAbToggle() {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const flags = useSyncExternalStore(
    subscribeMotionAb,
    motionAbFlags,
    serverFlags,
  );

  // The external half: write the flags to <html> for ring-hover.css.
  useEffect(() => {
    applyMotionAb();
  }, []);

  const visible =
    process.env.NODE_ENV !== "production" || motionAbFromUrl();

  if (!hydrated || !visible) return null;

  return (
    <div
      role="group"
      aria-label="Motion A/B variants"
      className="motion-ab"
      data-motion-ab-toggle=""
    >
      <span aria-hidden="true" className="motion-ab__label">
        A/B
      </span>
      {OPTIONS.map((option) => (
        <button
          key={option.flag}
          type="button"
          aria-pressed={flags[option.flag]}
          title={option.title}
          onClick={() => toggleMotionAbFlag(option.flag)}
          className="motion-ab__option"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
