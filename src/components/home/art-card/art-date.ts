import { shiftDateKey } from "@/lib/art-shared";

/**
 * Date helpers the card's client bundle can own.
 *
 * The stepping logic is shared with the server data layer (art-shared.ts) so
 * the browse window cannot drift from the server's; only the labelling lives
 * here. The server passes `today` and `oldest`, which keeps the window
 * authoritative in one place.
 */

export const shiftArtDate = shiftDateKey;

/** Short UTC label: "Today" or "Nov 24". Never depends on the visitor's TZ. */
export function formatArtDate(key: string, today: string): string {
  if (key === today) return "Today";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
}

/** Wall-label kicker: the day's state, in the museum's voice. */
export function artKicker(key: string, today: string): string {
  return key === today
    ? "Today’s painting"
    : `Daily painting · ${formatArtDate(key, today)}`;
}
