/**
 * Pure UTC-day and date-hash helpers for the daily data layer.
 *
 * Kept out of daily-art.ts so the clock, validation and hash logic stay free of
 * Next imports and can be read without the search/caching machinery.
 */

/** `new Date()` in UTC, as the key every cached pick is stored under. */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD key to its UTC midnight, or null when it is not a day. */
function parseDateKey(key: string): Date | null {
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

/** FNV-1a, unsigned. Small and stable across runtimes. */
export function hashDateKey(key: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

type SynopsisFacts = {
  medium: string | null;
  placeOfOrigin: string | null;
  styleTitle: string | null;
  dateDisplay: string | null;
};

/** One factual line when AIC has no museum text. Never fills a missing fact. */
export function factualSynopsis({
  medium,
  placeOfOrigin,
  styleTitle,
  dateDisplay,
}: SynopsisFacts): string {
  const date = dateDisplay && dateDisplay !== "Undated" ? dateDisplay : null;
  const headParts = [
    medium,
    placeOfOrigin ? `painted in ${placeOfOrigin}` : null,
    date,
  ].filter((part): part is string => Boolean(part));
  let head = headParts.join(", ");

  if (head) head = head.charAt(0).toUpperCase() + head.slice(1);

  if (head && styleTitle) return `${head} — ${styleTitle}.`;
  if (head) return `${head}.`;
  if (styleTitle) return `${styleTitle}.`;

  return "A painting from the Art Institute of Chicago.";
}
