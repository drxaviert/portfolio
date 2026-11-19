"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DrawerShell } from "./drawer-shell";

/**
 * `/work*`'s drawer. The layout is the drawer's home, so every page under it —
 * the index and each study — swaps inside the same panel: navigating from the
 * index to a study, or from one study to another, never remounts it.
 *
 * A direct load arrives with the panel already in the server markup, so the
 * drawer starts open at rest; a client navigation has no such markup, and the
 * drawer grows out of whatever it was opened from. (Same read-once trick as
 * HomeEntrancePlayed: the server only ever renders the direct route, and it
 * renders the resting state.)
 */
export function WorkDrawer({ children }: { children: ReactNode }) {
  const [resting] = useState(
    () =>
      typeof document === "undefined" ||
      document.querySelector(".wd-expand-layer") !== null,
  );

  return <DrawerShell resting={resting}>{children}</DrawerShell>;
}
