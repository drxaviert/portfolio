import { cacheLife } from "next/cache";
import {
  factualSynopsis,
  hashDateKey,
  isValidDateKey,
  utcDateKey,
} from "./art-shared";

export { hashDateKey, isValidDateKey, utcDateKey } from "./art-shared";

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
const MIN_ASPECT = 1 / 4;
const MAX_ASPECT = 4;

/**
 * Part of the cache key for the daily pick. Bump whenever DailyArt's shape or
 * mapping changes so a mapped record cached before the change cannot outlive
 * it. This is what keeps a new field (the synopsis) from silently disappearing
 * for the rest of a cached day.
 */
export const ART_DATA_VERSION = 2;

const SEARCH_FIELDS = [
  "id",
  "title",
  "artist_title",
  "date_display",
  "date_start",
  "place_of_origin",
  "style_title",
  "image_id",
  "thumbnail",
  "medium_display",
  "short_description",
  "description",
] as const;

/** The card's synopsis target, cut at a sentence boundary. */
const SYNOPSIS_LIMIT = 220;

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
  /** 1-3 stripped museum sentences, or one generated factual line. */
  synopsis: string;
  imageId: string | null;
  /** Original pixel dimensions, for the frame's aspect ratio. */
  width: number;
  height: number;
  /** AIC's tiny inline blur placeholder (a data URI), when available. */
  lqip: string | null;
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

export type AicArtwork = {
  id?: number | null;
  title?: string | null;
  artist_title?: string | null;
  date_display?: string | null;
  date_start?: number | null;
  place_of_origin?: string | null;
  style_title?: string | null;
  image_id?: string | null;
  thumbnail?: AicThumbnail | null;
  medium_display?: string | null;
  short_description?: string | null;
  description?: string | null;
};

type AicSearchResponse = {
  pagination?: { total?: number | null };
  data?: AicArtwork[] | null;
};

type FetchLike = typeof fetch;

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

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, code: string) => {
    if (code.startsWith("#")) {
      const hex = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);

      if (!Number.isFinite(point)) return " ";

      try {
        return String.fromCodePoint(point);
      } catch {
        return " ";
      }
    }

    return NAMED_ENTITIES[code.toLowerCase()] ?? " ";
  });
}

/** AIC descriptions arrive as HTML, sometimes with entities around tags. */
function plainText(value: string | null | undefined): string | null {
  if (!value) return null;

  const decoded = decodeHtml(value);
  const stripped = decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  const again = decodeHtml(stripped)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return again || null;
}

/**
 * Keep up to three sentences, stopping before the next sentence would pass the
 * 220-character target. The first sentence is always kept; a single oversized
 * sentence is cut at a word boundary with an ellipsis. Ends with punctuation
 * even when AIC's short_description withheld its final period.
 */
function clipSynopsis(value: string | null | undefined): string | null {
  const clean = plainText(value);

  if (!clean) return null;

  const sentences = clean
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  let out = "";
  let count = 0;

  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;

    if (out && next.length > SYNOPSIS_LIMIT) break;

    out = next;
    count += 1;

    if (count === 3 || out.length >= SYNOPSIS_LIMIT) break;
  }

  if (!out) return null;

  if (out.length > SYNOPSIS_LIMIT) {
    const clipped = out.slice(0, SYNOPSIS_LIMIT - 1);
    const lastSpace = clipped.lastIndexOf(" ");

    out = `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
  }

  if (!/[.!?…]["'”’)]*$/.test(out)) out = `${out}.`;

  return out;
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
  const rawDateDisplay =
    text(item.date_display) ?? (dateStart ? String(dateStart) : null);
  const placeOfOrigin = text(item.place_of_origin);
  const styleTitle = text(item.style_title);
  const medium = text(item.medium_display);
  const lqip = text(item.thumbnail?.lqip);
  const synopsis =
    clipSynopsis(item.short_description) ??
    clipSynopsis(item.description) ??
    factualSynopsis({
      medium,
      placeOfOrigin,
      styleTitle,
      dateDisplay: rawDateDisplay,
    });

  return {
    date: dateKey,
    id: id ?? 0,
    title,
    artist,
    dateDisplay: rawDateDisplay ?? "Undated",
    dateStart,
    placeOfOrigin,
    styleTitle,
    medium: medium ?? "Painting",
    synopsis,
    imageId,
    width,
    height,
    lqip: lqip?.startsWith("data:image/") ? lqip : null,
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
    synopsis:
      "A bundled stand-in while the Art Institute of Chicago is unavailable.",
    imageId: null,
    width: 4,
    height: 3,
    lqip: null,
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
    // 429/5xx are transient throttling. A 403 is a rejection (the old
    // too-many-results case, a bad body, or a block); retrying it only doubles
    // the wait before the fallback.
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
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
 * inject a fetch; `getTodaysArt` is the app-facing cached wrapper.
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
 * The day-keyed cache behind getTodaysArt. `cacheLife("days")` keeps the same
 * painting for the whole UTC day and lets the static shell include it; a
 * fallback is retried on the minutes profile instead of being pinned for a day.
 */
async function getDailyArt(
  dateKey: string,
  version: number,
): Promise<DailyArt> {
  "use cache";

  // The version is part of the cache key, not a branch in the body.
  void version;

  const art = await fetchDailyArt(dateKey);

  if (art.fallback) cacheLife("minutes");
  else cacheLife("days");

  return art;
}

/**
 * Today's painting, the only card state.
 *
 * `version` is part of both cache keys. Bump ART_DATA_VERSION when DailyArt's
 * shape or mapping changes: an entry cached under the old key cannot be served
 * with a field missing. Without that, a mapped record created before the
 * synopsis existed could keep the card synopsis blank for the cache lifetime.
 *
 * `new Date()` cannot be read in a prerendered component (Next 16 blocks it),
 * so the clock read lives inside this cached scope. The outer entry uses the
 * one-minute profile only to notice UTC midnight; the inner day-keyed entry
 * still does the real caching, so AIC sees the same handful of requests a day.
 */
export async function getTodaysArt(version: number): Promise<DailyArt> {
  "use cache";
  cacheLife("minutes");

  return getDailyArt(utcDateKey(), version);
}
