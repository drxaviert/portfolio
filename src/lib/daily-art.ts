import { cacheLife } from "next/cache";

/**
 * One public-domain painting per UTC day, from the Art Institute of Chicago.
 *
 * Server-only: the home card receives the plain `DailyArt` record as a prop.
 * The query is filtered live (public domain, paintings with a IIIF image) and
 * cached per day with `"use cache"` + `cacheLife("days")`, so the API sees at
 * most a couple of requests per day while every visitor of that day gets the
 * same painting. The date key is the cache key, and the day boundary is UTC so
 * the server and every visitor agree on which painting is "today".
 *
 * The pick is deterministic: FNV-1a of the date key chooses a 24-painting
 * window in an id-sorted result set, and the same hash rotation picks inside
 * it. Extreme aspect ratios and missing dimensions are skipped, not shown in a
 * broken frame. Any failure (network, bad payload, empty result) returns the
 * bundled stand-in so the card can never be empty.
 */

const AIC_SEARCH_URL = "https://api.artic.edu/api/v1/artworks/search";
/** Generic project name only; the AIC docs ask not to send an email address. */
export const AIC_USER_AGENT = "Daily-Painting/1.0";
const REQUEST_TIMEOUT_MS = 8_000;
const CANDIDATE_WINDOW = 24;
const RETRY_WINDOW = 100;
/**
 * AIC's public search refuses `from + limit > 1000` with a 403 ("Invalid
 * number of results"), regardless of the larger Elasticsearch window behind
 * it. The date hash must stay inside that accessible slice.
 */
const SEARCH_WINDOW = 1_000;
/** The card browses the current day plus the 29 before it. */
export const ART_HISTORY_DAYS = 30;
const MIN_ASPECT = 1 / 4;
const MAX_ASPECT = 4;

const SEARCH_FIELDS = [
  "id",
  "title",
  "artist_title",
  "artist_display",
  "date_display",
  "date_start",
  "place_of_origin",
  "style_title",
  "image_id",
  "thumbnail",
  "color",
  "medium_display",
] as const;

export type ArtColor = { h: number; s: number; l: number };

export type DailyArt = {
  /** UTC day the pick belongs to, YYYY-MM-DD. */
  date: string;
  id: number;
  title: string;
  artist: string;
  dateDisplay: string;
  /** Numeric start year, when the API has one; drives the frame's era. */
  dateStart: number | null;
  placeOfOrigin: string | null;
  styleTitle: string | null;
  medium: string;
  imageId: string | null;
  /** IIIF at 843px, the card's size. Null on the bundled fallback. */
  imageUrl: string | null;
  /** IIIF at 1686px for the full-view dialog. */
  largeImageUrl: string | null;
  /** Original pixel dimensions, for the frame's aspect ratio. */
  width: number;
  height: number;
  /** AIC's tiny inline blur placeholder (a data URI), when available. */
  lqip: string | null;
  /** Dominant colour, when the API has one; tints the card wall. */
  color: ArtColor | null;
  articUrl: string | null;
  alt: string;
  fallback: boolean;
};

type AicThumbnail = {
  width?: number | null;
  height?: number | null;
  lqip?: string | null;
  alt_text?: string | null;
};

type AicColor = {
  h?: number | null;
  s?: number | null;
  l?: number | null;
};

export type AicArtwork = {
  id?: number | null;
  title?: string | null;
  artist_title?: string | null;
  artist_display?: string | null;
  date_display?: string | null;
  date_start?: number | null;
  place_of_origin?: string | null;
  style_title?: string | null;
  image_id?: string | null;
  thumbnail?: AicThumbnail | null;
  color?: AicColor | null;
  medium_display?: string | null;
};

type AicSearchResponse = {
  pagination?: { total?: number | null };
  data?: AicArtwork[] | null;
};

type FetchLike = typeof fetch;

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

/**
 * A painting wider than 4:1 or taller than 1:4 cannot be hung in the card's
 * frame without turning into a strip, so it is rejected in favour of the next
 * usable record.
 */
export function isAcceptableAspect(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width <= 0 || height <= 0) return false;

  const aspect = width / height;

  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

export function iiifUrl(imageId: string, width: 843 | 1686): string {
  return `https://www.artic.edu/iiif/2/${encodeURIComponent(imageId)}/full/${width},/0/default.jpg`;
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usableArtwork(item: AicArtwork): boolean {
  const imageId = text(item.image_id);
  const width = finiteNumber(item.thumbnail?.width);
  const height = finiteNumber(item.thumbnail?.height);

  if (!imageId || width === null || height === null) return false;

  return isAcceptableAspect(width, height);
}

/**
 * Deterministic pick. Records are ordered by id first so an API reorder cannot
 * change the painting; the date hash sets the start, then the list is scanned
 * forward (wrapping once) for the first record that can be framed.
 */
export function pickArtwork(
  items: readonly AicArtwork[],
  dateKey: string,
): AicArtwork | null {
  if (items.length === 0) return null;

  const ordered = [...items].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const start = hashDateKey(dateKey) % ordered.length;

  for (let step = 0; step < ordered.length; step += 1) {
    const candidate = ordered[(start + step) % ordered.length];

    if (usableArtwork(candidate)) return candidate;
  }

  return null;
}

export function toDailyArt(item: AicArtwork, dateKey: string): DailyArt | null {
  if (!usableArtwork(item)) return null;

  const id = finiteNumber(item.id);
  const width = item.thumbnail?.width as number;
  const height = item.thumbnail?.height as number;
  const imageId = text(item.image_id) as string;
  const title = text(item.title) ?? "Untitled";
  const artist = text(item.artist_title) ?? "Unknown artist";
  const dateStart = finiteNumber(item.date_start);
  const color = item.color;
  const lqip = text(item.thumbnail?.lqip);
  const colorValue =
    color &&
    finiteNumber(color.h) !== null &&
    finiteNumber(color.s) !== null &&
    finiteNumber(color.l) !== null
      ? { h: color.h as number, s: color.s as number, l: color.l as number }
      : null;

  return {
    date: dateKey,
    id: id ?? 0,
    title,
    artist,
    dateDisplay:
      text(item.date_display) ?? (dateStart ? String(dateStart) : "Undated"),
    dateStart,
    placeOfOrigin: text(item.place_of_origin),
    styleTitle: text(item.style_title),
    medium: text(item.medium_display) ?? "Painting",
    imageId,
    imageUrl: iiifUrl(imageId, 843),
    largeImageUrl: iiifUrl(imageId, 1686),
    width,
    height,
    lqip: lqip?.startsWith("data:image/") ? lqip : null,
    color: colorValue,
    articUrl: id === null ? null : `https://www.artic.edu/artworks/${id}`,
    alt:
      text(item.thumbnail?.alt_text) ??
      `${title} by ${artist}, ${text(item.date_display) ?? "undated"}`,
    fallback: false,
  };
}

/**
 * The card's stand-in: a bundled abstract landscape, not a network request.
 * It keeps the frame, label and controls in their real shapes while the API is
 * unreachable.
 */
export function fallbackArt(dateKey: string): DailyArt {
  return {
    date: dateKey,
    id: 0,
    title: "The gallery is quiet today",
    artist: "Daily Painting",
    dateDisplay: "A stand-in",
    dateStart: null,
    placeOfOrigin: null,
    styleTitle: null,
    medium: "Ink, light and a little patience",
    imageId: null,
    imageUrl: null,
    largeImageUrl: null,
    width: 4,
    height: 3,
    lqip: null,
    color: { h: 38, s: 30, l: 56 },
    articUrl: null,
    alt: "A muted abstract landscape standing in for today's painting.",
    fallback: true,
  };
}

async function searchAic(
  fetchImpl: FetchLike,
  body: Record<string, unknown>,
  attempt = 0,
): Promise<AicSearchResponse> {
  const response = await fetchImpl(AIC_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "AIC-User-Agent": AIC_USER_AGENT,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // 403/429/5xx from the public API are usually transient throttling. One
    // short retry protects a day's pick without turning a bad day into a loop.
    if (
      attempt === 0 &&
      (response.status === 403 ||
        response.status === 429 ||
        response.status >= 500)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return searchAic(fetchImpl, body, attempt + 1);
    }

    const detail = (await response.text().catch(() => "")).slice(0, 300);

    throw new Error(
      `AIC search failed with ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  return (await response.json()) as AicSearchResponse;
}

const BASE_QUERY = {
  query: {
    bool: {
      must: [
        { term: { is_public_domain: true } },
        { term: { "artwork_type_title.keyword": "Painting" } },
        { exists: { field: "image_id" } },
      ],
    },
  },
  sort: [{ id: "asc" }],
} as const;

/**
 * The uncached loader: two AIC calls (a count, then a window of candidates),
 * a deterministic pick and the fallback. Exported for the unit tests, which
 * inject a fetch; `getDailyArt` is the app-facing cached wrapper.
 */
export async function fetchDailyArt(
  dateKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<DailyArt> {
  if (!isValidDateKey(dateKey)) {
    throw new RangeError(`Not a UTC date key: ${dateKey}`);
  }

  try {
    const first = await searchAic(fetchImpl, {
      ...BASE_QUERY,
      fields: ["id"],
      limit: 1,
      from: 0,
    });
    const total = finiteNumber(first.pagination?.total) ?? 0;

    if (total <= 0) return fallbackArt(dateKey);

    const seeded = hashDateKey(dateKey);
    const available = Math.min(total, SEARCH_WINDOW);
    const window = Math.min(CANDIDATE_WINDOW, available);
    const maxStart = Math.max(0, available - window);
    const from = maxStart > 0 ? seeded % (maxStart + 1) : 0;

    const result = await searchAic(fetchImpl, {
      ...BASE_QUERY,
      fields: SEARCH_FIELDS,
      limit: window,
      from,
    });
    const picked = pickArtwork(result.data ?? [], dateKey);
    const daily = picked ? toDailyArt(picked, dateKey) : null;

    if (daily) return daily;

    // The seeded window had no framable painting (rare: extreme ratios, missing
    // dimensions). Re-seed from the start of the collection before giving up.
    if (from > 0) {
      const retry = await searchAic(fetchImpl, {
        ...BASE_QUERY,
        fields: SEARCH_FIELDS,
        limit: Math.min(RETRY_WINDOW, total, SEARCH_WINDOW),
        from: 0,
      });
      const retryPick = pickArtwork(retry.data ?? [], dateKey);

      if (retryPick) {
        const retryDaily = toDailyArt(retryPick, dateKey);

        if (retryDaily) return retryDaily;
      }
    }

    return fallbackArt(dateKey);
  } catch (error) {
    // A fallback must not hide an outage silently; it also must not be cached
    // for a day, or the card stays empty long after the API recovers.
    console.warn(
      `[daily-art] AIC unavailable for ${dateKey}:`,
      error instanceof Error ? error.message : error,
    );

    return fallbackArt(dateKey);
  }
}

/**
 * The app-facing loader. The date is the cache key; `cacheLife("days")` keeps
 * the same painting for the whole UTC day and lets the static shell include it.
 * A fallback is retried on the minutes profile instead of being pinned for a
 * day.
 */
export async function getDailyArt(dateKey: string): Promise<DailyArt> {
  "use cache";

  const art = await fetchDailyArt(dateKey);

  if (art.fallback) cacheLife("minutes");
  else cacheLife("days");

  return art;
}

/**
 * Today's painting plus the window the card may browse.
 *
 * `new Date()` cannot be read in a prerendered component (Next 16 blocks it),
 * so the clock read lives inside this cached scope. The outer entry uses the
 * one-minute profile only to notice UTC midnight; the inner day-keyed entry
 * still does the real caching, so AIC sees the same handful of requests a day.
 */
export async function getTodaysArt(): Promise<{
  art: DailyArt;
  today: string;
  oldest: string;
}> {
  "use cache";
  cacheLife("minutes");

  const today = utcDateKey();

  return {
    art: await getDailyArt(today),
    today,
    oldest: historyStartDate(today),
  };
}
