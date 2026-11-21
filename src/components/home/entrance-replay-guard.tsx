"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * One home entrance per document.
 *
 * The first shipped HomeScreen claims the entrance; the claim is the main
 * element itself, not a per-effect flag, so React StrictMode's double effect
 * on the same copy does not mistake it for a second one. A later copy — the
 * work layout's HomeScreen under the drawer — marks itself
 * `data-entrance-replay="later"` in a layout effect, so its veil and cards
 * mount at their resting state instead of replaying the 1400ms Soft focus
 * while the drawer opens. The first copy's animations, including the shared
 * horizon's softness, continue untouched.
 */
let owner: HTMLElement | null = null;

export function EntranceReplayGuard() {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const main = ref.current?.closest<HTMLElement>("[data-entrance-shipped]");
    if (!main) return;

    if (!owner) {
      owner = main;
      return;
    }

    // StrictMode runs this effect twice on the first copy: same element, not
    // a later copy.
    if (owner === main) return;

    main.dataset.entranceReplay = "later";
  }, []);

  return <span ref={ref} hidden />;
}
