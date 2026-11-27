/**
 * Returning to a study from a full-screen route is not the drawer's first
 * in-app entry: the study was already open behind the route. Without a hint,
 * the remounted drawer replays its entry flight from the trigger while the
 * route transition is still landing, so the tile lands on a moving page.
 *
 * The full-screen route marks this before navigating back; the drawer starts
 * at rest, exactly as a direct load does, and the route transition owns the
 * arrival.
 */
const STORAGE_KEY = "work-drawer:restore";

export function markDrawerRestore(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private modes can refuse storage; the drawer falls back to its flight.
  }
}

export function consumeDrawerRestore(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const restore = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    window.sessionStorage.removeItem(STORAGE_KEY);
    return restore;
  } catch {
    return false;
  }
}
