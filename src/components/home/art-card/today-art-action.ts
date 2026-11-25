"use server";

import { getTodaysArt } from "@/lib/daily-art";

/**
 * Server Action wrapper for the Play card.
 *
 * `home-layout.tsx` is also imported by a client dev harness (the entrance
 * prototype), so every module it reaches must be safe in the browser graph.
 * daily-art.ts owns `next/cache`, which is server-only; exporting the cached
 * loader through a `"use server"` module gives the shell a reference instead of
 * dragging the data layer into the client bundle. The action is only called
 * from the async server branch of PlayCard.
 */
export async function loadTodaysArt() {
  return getTodaysArt();
}
