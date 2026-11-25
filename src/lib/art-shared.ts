/**
 * Pure UTC-day and date-hash helpers.
 *
 * Shared by the server data layer (`daily-art.ts`) and the client card
 * (`art-date.ts`, `tilt.ts`). Nothing here imports Next or touches the
 * network, so both graphs can use the same implementation and one change
 * cannot leave a copy stale.
 */

/** The card browses the current day plus the 29 before it. */
export const ART_HISTORY_DAYS = 30;

/** `new Date()` in UTC, as the key every cached pick is stored under. */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD key to its UTC midnight, or null when it is not a day. */
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null;
}

/** Step a valid key by whole days; month and year boundaries are handled. */
export function shiftDateKey(key: string, days: number): string {
  const date = parseDateKey(key);

  if (!date) throw new RangeError(`Not a UTC date key: ${key}`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** Oldest day the card may browse; today counts as day one. */
export function historyStartDate(
  today: string,
  days = ART_HISTORY_DAYS,
): string {
  return shiftDateKey(today, -(days - 1));
}

export function isWithinHistory(date: string, today: string): boolean {
  return date <= today && date >= historyStartDate(today);
}

/** FNV-1a, unsigned. Small and stable across runtimes. */
export function hashDateKey(key: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
