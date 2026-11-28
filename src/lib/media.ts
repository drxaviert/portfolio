import fs from "node:fs";
import path from "node:path";
import type {
  ImageFormat,
  MediaManifest,
  MediaSource,
  VideoHls,
} from "./media-types";

export type {
  HlsLevel,
  ImageFormat,
  ImageMedia,
  MediaManifest,
  MediaPoster,
  MediaSource,
  VideoFile,
  VideoHls,
  VideoMedia,
} from "./media-types";
export { isImageMedia, isVideoMedia } from "./media-types";

/**
 * What a study cover needs to draw itself: one AVIF, one fallback and the
 * dimensions the manifest already recorded. The cover is a picture, so a video
 * cover uses its poster.
 */
export type CoverImage = {
  avif: string;
  fallback: string;
  fallbackType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  /** The 16px blur, which only an image manifest has. */
  lqip?: string;
};

const MEDIA_DIR = path.join(process.cwd(), "content", "media");

/** Content-addressed ids are `<slug>-<hash>`; anything else is a typo. */
const MEDIA_ID = /^[a-z0-9][a-z0-9-]*$/;

const COVER_TARGET_WIDTH = 1280;

/**
 * One read per id per process and per origin. The production manifest is cached
 * once; `MEDIA_ORIGIN=local` keeps a second, rewritten copy so `getMedia`
 * returns a stable object in both modes.
 */
const cache = new Map<string, MediaManifest>();
const localCache = new Map<string, MediaManifest>();

function invalid(id: string, reason: string): never {
  throw new Error(`content/media/${id}.json is invalid: ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

function isDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isBytes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readSources(id: string, value: unknown): MediaSource[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(id, "sources must be a non-empty array");
  }

  const sources = value.map((source, index) => {
    if (!isRecord(source)) invalid(id, `sources[${index}] must be an object`);
    if (source.format !== "avif" && source.format !== "webp") {
      invalid(id, `sources[${index}].format must be avif or webp`);
    }
    if (!isDimension(source.width)) {
      invalid(id, `sources[${index}].width must be a positive integer`);
    }
    if (!isUrl(source.url)) {
      invalid(id, `sources[${index}].url must be an https URL`);
    }

    return {
      format: source.format as ImageFormat,
      width: source.width,
      url: source.url,
    };
  });

  return sources.sort((a, b) => a.width - b.width);
}

function readVideoFile(
  id: string,
  field: string,
  value: unknown,
): { url: string; bytes: number } {
  if (!isRecord(value)) invalid(id, `${field} must be an object`);
  if (!isUrl(value.url)) invalid(id, `${field}.url must be an https URL`);
  if (!isBytes(value.bytes)) {
    invalid(id, `${field}.bytes must be a positive integer`);
  }

  return { url: value.url, bytes: value.bytes };
}

/**
 * The adaptive ladder: a master playlist, the bytes behind it and the rungs it
 * advertises. A half-uploaded ladder is as broken as a missing MP4, so every
 * part is required once `hls` is present.
 */
function readHls(id: string, value: unknown): VideoHls {
  if (!isRecord(value)) invalid(id, "hls must be an object");
  if (!isUrl(value.url) || !value.url.endsWith(".m3u8")) {
    invalid(id, "hls.url must be an https URL ending in .m3u8");
  }
  if (!isBytes(value.bytes)) {
    invalid(id, "hls.bytes must be a positive integer");
  }
  if (!Array.isArray(value.levels) || value.levels.length === 0) {
    invalid(id, "hls.levels must be a non-empty array");
  }

  const levels = value.levels.map((level, index) => {
    if (!isRecord(level)) invalid(id, `hls.levels[${index}] must be an object`);
    if (!isDimension(level.height)) {
      invalid(id, `hls.levels[${index}].height must be a positive integer`);
    }
    if (typeof level.bandwidth !== "number" || !(level.bandwidth > 0)) {
      invalid(id, `hls.levels[${index}].bandwidth must be a positive number`);
    }

    return { height: level.height, bandwidth: level.bandwidth };
  });

  return { url: value.url, bytes: value.bytes, levels };
}

/**
 * Checks the manifest against the shape `scripts/post.ts` writes. Failing here
 * fails the build, which is the point: a typo in an id or a half-finished
 * upload should never reach a reader as a broken <img> or <video>.
 *
 * Exported so the shape can be tested without writing files into
 * `content/media/`.
 */
export function validateManifest(id: string, raw: unknown): MediaManifest {
  if (!isRecord(raw)) invalid(id, "expected an object");
  if (raw.id !== id) invalid(id, `id is "${String(raw.id)}"`);

  if (raw.kind !== "image" && raw.kind !== "video") {
    invalid(id, 'kind must be "image" or "video"');
  }
  if (!isDimension(raw.width)) invalid(id, "width must be a positive integer");
  if (!isDimension(raw.height)) {
    invalid(id, "height must be a positive integer");
  }
  if (!isText(raw.alt)) invalid(id, "alt must be a string");
  if (!isText(raw.caption)) invalid(id, "caption must be a string");
  if (!isText(raw.createdAt)) invalid(id, "createdAt must be a string");
  if (!isText(raw.original)) invalid(id, "original must be a string");

  const base = {
    id,
    width: raw.width,
    height: raw.height,
    alt: raw.alt,
    caption: raw.caption,
    createdAt: raw.createdAt,
    original: raw.original,
  };

  if (raw.kind === "image") {
    const sources = readSources(id, raw.sources);
    if (!isText(raw.lqip) || !raw.lqip.startsWith("data:image/")) {
      invalid(id, "lqip must be an image data URI");
    }

    return { ...base, kind: "image", sources, lqip: raw.lqip };
  }

  const mp4 = readVideoFile(id, "mp4", raw.mp4);
  const webm =
    raw.webm === undefined ? undefined : readVideoFile(id, "webm", raw.webm);
  const canvas =
    raw.canvas === undefined
      ? undefined
      : readVideoFile(id, "canvas", raw.canvas);
  const hls = raw.hls === undefined ? undefined : readHls(id, raw.hls);

  if (!isRecord(raw.poster)) invalid(id, "poster must be an object");
  if (!isUrl(raw.poster.avif)) {
    invalid(id, "poster.avif must be an https URL");
  }
  if (!isUrl(raw.poster.jpg)) {
    invalid(id, "poster.jpg must be an https URL");
  }
  if (typeof raw.duration !== "number" || !(raw.duration > 0)) {
    invalid(id, "duration must be a positive number");
  }
  if (typeof raw.hasAudio !== "boolean") {
    invalid(id, "hasAudio must be a boolean");
  }

  return {
    ...base,
    kind: "video",
    mp4,
    ...(webm ? { webm } : {}),
    ...(canvas ? { canvas } : {}),
    ...(hls ? { hls } : {}),
    poster: { avif: raw.poster.avif, jpg: raw.poster.jpg },
    duration: raw.duration,
    hasAudio: raw.hasAudio,
  };
}

/**
 * `MEDIA_ORIGIN=local` rewrites every manifest URL to the dev route
 * `/media/local/<key>`. The route serves `media/local/`, populated by
 * `pnpm post --local` or the migration's `--local` flag. This is dev/test only:
 * production builds leave the env unset and keep the R2 URLs in the manifest.
 */
export function localMediaEnabled(): boolean {
  return process.env.MEDIA_ORIGIN === "local";
}

/** `https://host[/prefix]/media/<id>/file` → `/media/local/media/<id>/file`. */
function localMediaUrl(url: string): string {
  if (url.startsWith("/media/local/")) return url;
  const { pathname } = new URL(url);
  const keyAt = pathname.indexOf("/media/");
  const key = keyAt >= 0 ? pathname.slice(keyAt) : pathname;
  return `/media/local${key.startsWith("/") ? key : `/${key}`}`;
}

/**
 * A copy of `manifest` with every public URL pointed at the local route. The
 * input is the validated production manifest, so `new URL` cannot fail here.
 */
export function rewriteMediaUrls(manifest: MediaManifest): MediaManifest {
  if (manifest.kind === "image") {
    return {
      ...manifest,
      sources: manifest.sources.map((source) => ({
        ...source,
        url: localMediaUrl(source.url),
      })),
    };
  }

  return {
    ...manifest,
    mp4: { ...manifest.mp4, url: localMediaUrl(manifest.mp4.url) },
    ...(manifest.webm
      ? { webm: { ...manifest.webm, url: localMediaUrl(manifest.webm.url) } }
      : {}),
    ...(manifest.canvas
      ? {
          canvas: {
            ...manifest.canvas,
            url: localMediaUrl(manifest.canvas.url),
          },
        }
      : {}),
    ...(manifest.hls
      ? { hls: { ...manifest.hls, url: localMediaUrl(manifest.hls.url) } }
      : {}),
    poster: {
      avif: localMediaUrl(manifest.poster.avif),
      jpg: localMediaUrl(manifest.poster.jpg),
    },
  };
}

export function getMedia(id: string): MediaManifest {
  const local = localMediaEnabled();
  const originCache = local ? localCache : cache;
  const cached = originCache.get(id);
  if (cached) return cached;

  if (!MEDIA_ID.test(id)) {
    throw new Error(
      `"${id}" is not a media id; expected the slug-hash from content/media/<id>.json`,
    );
  }

  const file = path.join(MEDIA_DIR, `${id}.json`);

  if (!fs.existsSync(file)) {
    throw new Error(
      `No manifest for media "${id}": expected content/media/${id}.json. Drop the file in media/inbox/ and run \`pnpm post\`.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read content/media/${id}.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const manifest = validateManifest(id, parsed);
  cache.set(id, manifest);
  if (!local) return manifest;

  const rewritten = rewriteMediaUrls(manifest);
  localCache.set(id, rewritten);
  return rewritten;
}

/**
 * Every manifest in `content/media`, newest first.
 *
 * Each file is read through `getMedia`, so the library can only ever list an id
 * that a real page could draw: a broken manifest fails here the same way it
 * fails a build. Manifests without a parseable `createdAt` sort last and ties
 * fall back to the id, so the order is stable between runs.
 */
export function listMedia(): MediaManifest[] {
  if (!fs.existsSync(MEDIA_DIR)) return [];

  const time = (media: MediaManifest) => {
    const parsed = Date.parse(media.createdAt);
    return Number.isNaN(parsed) ? -Infinity : parsed;
  };

  return fs
    .readdirSync(MEDIA_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => getMedia(file.slice(0, -".json".length)))
    .sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id));
}

/** The widest variant at or below the cover target, so a card never fetches 2560. */
function pickWidth(sources: MediaSource[], format: ImageFormat): MediaSource {
  const matching = sources.filter((source) => source.format === format);
  if (matching.length === 0) {
    throw new Error(`the manifest has no ${format} source`);
  }

  const below = matching.filter((source) => source.width <= COVER_TARGET_WIDTH);

  return (below.at(-1) ?? matching[0]) as MediaSource;
}

/** The picture a study's `cover: "media:<id>"` resolves to. */
export function coverImageFor(id: string): CoverImage {
  const media = getMedia(id);

  if (media.kind === "video") {
    return {
      avif: media.poster.avif,
      fallback: media.poster.jpg,
      fallbackType: "image/jpeg",
      width: media.width,
      height: media.height,
    };
  }

  const avif = pickWidth(media.sources, "avif");
  const webp = pickWidth(media.sources, "webp");

  return {
    avif: avif.url,
    fallback: webp.url,
    fallbackType: "image/webp",
    width: media.width,
    height: media.height,
    lqip: media.lqip,
  };
}

/**
 * A /work row's hover video: the small canvas encode, never the full mp4, with
 * the poster as the still it shows before it plays and under reduced motion.
 */
export type ThumbVideo = {
  src: string;
  poster: string;
  width: number;
  height: number;
};

/** The video a study's `thumb: "media:<id>"` resolves to. */
export function thumbVideoFor(id: string): ThumbVideo {
  const media = getMedia(id);

  if (media.kind !== "video" || !media.canvas) {
    throw new Error(`thumb media "${id}" must be a video with a canvas encode`);
  }

  return {
    src: media.canvas.url,
    poster: media.poster.jpg,
    width: media.width,
    height: media.height,
  };
}
