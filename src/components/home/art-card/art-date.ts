/**
 * Date helpers the card's client bundle can own.
 *
 * daily-art.ts is server-only (it imports next/cache); the card still needs to
 * step and label days for the browse controls, so the tiny pure UTC helpers
 * live here. The server passes `today` and `oldest`, which keeps the window
 * authoritative in one place.
 */

export function shiftArtDate(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

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
