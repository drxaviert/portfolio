#!/usr/bin/env node
/**
 * `pnpm post` — local media ingest.
 *
 * For every file dropped in `media/inbox/` this:
 *   1. derives a content-addressed id (`slug-sha256[:10]`),
 *   2. encodes web variants with sharp (images) or ffmpeg (video),
 *   3. uploads them to Vercel Blob under `media/<id>/`,
 *   4. writes `content/media/<id>.json`, and
 *   5. moves the original to `media/archive/` (never deletes it).
 *
 * Re-running is a no-op for anything that already has a manifest. Encoding happens in a
 * throwaway directory under `os.tmpdir()`; uploads are skipped with `--dry-run`.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  put,
} from "@vercel/blob";
import sharp from "sharp";
import type {
  ImageMedia,
  MediaManifest,
  MediaSource,
  VideoMedia,
} from "../src/lib/media-types";
import { WORK_BODIES } from "../src/lib/work-bodies.ts";
import { refreshBlobEnv } from "./lib/blob-env.ts";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const INBOX_DIR = path.join(ROOT, "media", "inbox");
const ARCHIVE_DIR = path.join(ROOT, "media", "archive");
const MANIFEST_DIR = path.join(ROOT, "content", "media");
const POSTS_DIR = path.join(ROOT, "content", "posts");

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "tif",
  "tiff",
]);
const VIDEO_EXTENSIONS = new Set(["mov", "mp4", "m4v", "webm", "mkv"]);
const IMAGE_WIDTHS = [640, 1280, 1920, 2560];

const MP4_WARN_BYTES = 6 * 1024 * 1024;
const MP4_MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_HEIGHT = 1080;

/** Above this many seconds a clip is worth an adaptive ladder instead of one MP4. */
export const HLS_MIN_DURATION = 20;
const HLS_WARN_BYTES = 60 * 1024 * 1024;
const HLS_MAX_BYTES = 150 * 1024 * 1024;

/** One rung of the adaptive ladder: a height cap and the bitrate that caps it. */
export interface HlsRung {
  height: number;
  maxrate: string;
  bufsize: string;
}

const HLS_LADDER: readonly HlsRung[] = [
  { height: 1080, maxrate: "5000k", bufsize: "10000k" },
  { height: 720, maxrate: "2800k", bufsize: "5600k" },
  { height: 480, maxrate: "1200k", bufsize: "2400k" },
];

/** A source too small for the 480 rung still needs one, at a bitrate that fits. */
const HLS_SMALL_RUNG = { maxrate: "800k", bufsize: "1600k" };

interface CliOptions {
  alt?: string;
  post?: string;
  study?: string;
  audio: boolean;
  webm: boolean;
  hls: boolean;
  noHls: boolean;
  posterAt: number;
  dryRun: boolean;
  help: boolean;
}

interface Job {
  name: string;
  file: string;
  ext: string;
  kind: "image" | "video";
  id: string;
}

interface ProbeResult {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

class UsageError extends Error {}

/**
 * The studies the site can open, from the same importer map `/work/<slug>` uses.
 * A new study needs an entry there, so an unknown `--study` slug is caught before
 * any encoding or upload.
 */
const STUDY_SLUGS: readonly string[] = Object.keys(WORK_BODIES);

export function assertStudySlug(slug: string): void {
  if (!STUDY_SLUGS.includes(slug)) {
    throw new UsageError(
      `unknown study slug "${slug}"; expected one of: ${STUDY_SLUGS.join(", ")}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    audio: false,
    webm: false,
    hls: false,
    noHls: false,
    posterAt: 0,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);

    const value = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[++i];
      if (next === undefined) throw new UsageError(`${flag} needs a value`);
      return next;
    };

    switch (flag) {
      case "--alt":
        options.alt = value();
        break;
      case "--post":
        options.post = value();
        break;
      case "--study":
        options.study = value();
        break;
      case "--poster-at": {
        const raw = value();
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0)
          throw new UsageError(`--poster-at expects seconds, got "${raw}"`);
        options.posterAt = parsed;
        break;
      }
      case "--audio":
        options.audio = true;
        break;
      case "--webm":
        options.webm = true;
        break;
      case "--hls":
        options.hls = true;
        break;
      case "--no-hls":
        options.noHls = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new UsageError(
          arg.startsWith("-")
            ? `unknown flag "${arg}"`
            : `unexpected argument "${arg}"`,
        );
    }
  }

  if (options.post !== undefined && options.post.trim() === "") {
    throw new UsageError("--post needs a caption");
  }
  if (options.study !== undefined && options.study.trim() === "") {
    throw new UsageError("--study needs a slug");
  }
  if (options.hls && options.noHls) {
    throw new UsageError("--hls and --no-hls contradict each other");
  }

  return options;
}

function printHelp(): void {
  console.log(`pnpm post — encode media/inbox/ and publish it to Vercel Blob

Usage
  pnpm post [options]

Every file in media/inbox/ is encoded, uploaded to media/<id>/ and described in
content/media/<id>.json. The original is then moved to media/archive/<id>.<ext>.
Files that already have a manifest are skipped, so re-running is safe.

Options
  --alt "<text>"        Alt text. Only valid when a single file is in the inbox;
                        otherwise you are prompted per file.
  --post "<caption>"    Also write content/posts/<yyyy-mm-dd>-<slug>.mdx.
  --study <slug>        Print snippets to paste into content/work/<slug>.mdx.
                        The slug must be an existing study; it does not filter.
  --audio               Keep audio in the encoded video (AAC 128k).
  --webm                Also encode a VP9 WebM alongside the MP4.
  --hls                 Force an HLS ladder even for a clip under 20 s.
  --no-hls              Keep a single progressive MP4 even past 20 s.
  --poster-at <sec>     Poster frame timestamp in seconds. Default: 0.
  --dry-run             Encode and report, but do not upload or write anything.
  --help, -h            Show this help.

Video
  A clip longer than 20 s is encoded as an HLS ladder (1080/720/480, dropping
  rungs above the source) plus a low-rung progressive MP4 as the required
  fallback. Shorter clips stay one MP4. HLS budgets: warn over 60 MB, fail over
  150 MB. The 10 MB MP4 cap applies to non-HLS clips only.

Environment
  Blob auth comes from .env.blob (BLOB_STORE_ID + VERCEL_OIDC_TOKEN). A missing
  token, or one within 15 minutes of expiry, is refreshed automatically with
  \`pnpm blob:env\` (vercel env pull). BLOB_READ_WRITE_TOKEN in .env.local or the
  environment also works and is never refreshed. Not needed with --dry-run.
  ffmpeg and ffprobe must be on PATH.
`);
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slugify(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

function loadEnv(): void {
  // `.env.blob` first: the freshly pulled OIDC token must win over a stale copy in
  // `.env.local`, and process.loadEnvFile never overwrites an already-set variable.
  for (const file of [".env.blob", ".env.local"]) {
    const envPath = path.join(ROOT, file);
    if (existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

const AUTH_HINT =
  "Blob auth expired or missing: run  vercel env pull .env.blob --environment=production --yes";

function hasBlobAuth(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  return Boolean(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN);
}

function isAuthError(error: unknown): boolean {
  if (
    error instanceof BlobAccessError ||
    error instanceof BlobClientTokenExpiredError
  ) {
    return true;
  }
  const status = (error as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) return true;
  return /oidc|missing credentials|unauthorized|forbidden|\b(401|403)\b|token.*expired|expired.*token/i.test(
    errorMessage(error),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function mediaId(file: string, name: string): Promise<string> {
  const hash = createHash("sha256")
    .update(await readFile(file))
    .digest("hex")
    .slice(0, 10);
  const base = path.parse(name).name;
  const slug = slugify(base, 40) || "media";
  return `${slug}-${hash}`;
}

async function publish(
  pathname: string,
  body: Buffer,
  contentType: string,
  dryRun: boolean,
): Promise<string> {
  if (dryRun) {
    console.log(
      `  dry-run  would upload ${pathname} (${contentType}, ${formatBytes(body.byteLength)})`,
    );
    return `https://dry-run.invalid/${pathname}`;
  }

  try {
    const blob = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      contentType,
    });
    console.log(`  upload   ${pathname} (${formatBytes(body.byteLength)})`);
    return blob.url;
  } catch (error) {
    if (isAuthError(error)) {
      console.error(`\n${AUTH_HINT}\n  cause: ${errorMessage(error)}\n`);
      throw new Error("blob upload was rejected (auth)");
    }
    throw error;
  }
}

const UPLOAD_CONCURRENCY = 6;

/**
 * Uploads a ladder in a fixed-width pool: a 40-file encode would otherwise open
 * 40 sockets at once and slow every one of them down. A failure rejects the
 * pool, which fails the file before its manifest is written.
 */
async function publishAll(
  id: string,
  files: { relative: string; body: Buffer; contentType: string }[],
  dryRun: boolean,
): Promise<Map<string, string>> {
  const bytes = files.reduce((total, file) => total + file.body.byteLength, 0);
  console.log(`  info     hls ${files.length} files · ${formatBytes(bytes)}`);

  const urls = new Map<string, string>();
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const file = files[next++];
      const url = await publish(
        `media/${id}/hls/${file.relative}`,
        file.body,
        file.contentType,
        dryRun,
      );
      urls.set(file.relative, url);
    }
  };

  const width = Math.min(UPLOAD_CONCURRENCY, files.length);
  await Promise.all(Array.from({ length: width }, worker));
  return urls;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every standard width below the source, plus the source width itself so a 1600px
 * original keeps a 1600px variant. Never upscales.
 */
function imageWidths(sourceWidth: number): number[] {
  const widths = IMAGE_WIDTHS.filter((width) => width < sourceWidth);
  widths.push(sourceWidth);
  return widths;
}

async function processImage(
  job: Job,
  alt: string,
  caption: string,
  dryRun: boolean,
): Promise<ImageMedia> {
  const metadata = await sharp(job.file).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("sharp could not read the image dimensions");
  }

  // `.rotate()` bakes in EXIF orientation, so 5–8 mean the displayed image is swapped.
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;

  const sources: MediaSource[] = [];

  for (const targetWidth of imageWidths(width)) {
    const resized = sharp(job.file)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true });

    const [avif, webp] = await Promise.all([
      resized.clone().avif({ quality: 55 }).toBuffer(),
      resized.clone().webp({ quality: 75 }).toBuffer(),
    ]);

    const avifName = `w${targetWidth}.avif`;
    const webpName = `w${targetWidth}.webp`;

    sources.push({
      format: "avif",
      width: targetWidth,
      url: await publish(
        `media/${job.id}/${avifName}`,
        avif,
        "image/avif",
        dryRun,
      ),
    });
    sources.push({
      format: "webp",
      width: targetWidth,
      url: await publish(
        `media/${job.id}/${webpName}`,
        webp,
        "image/webp",
        dryRun,
      ),
    });
  }

  const lqipBuffer = await sharp(job.file)
    .rotate()
    .resize({ width: 16 })
    .webp({ quality: 50 })
    .toBuffer();

  return {
    id: job.id,
    kind: "image",
    width,
    height,
    alt,
    caption,
    createdAt: new Date().toISOString(),
    original: job.name,
    sources,
    lqip: `data:image/webp;base64,${lqipBuffer.toString("base64")}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

async function probeVideo(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);

  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
      side_data_list?: Array<{ rotation?: number }>;
    }>;
  };

  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video?.height)
    throw new Error("ffprobe found no video stream");

  // ffmpeg auto-rotates on decode; match the display orientation here.
  const rotation =
    video.side_data_list?.find((side) => side.rotation !== undefined)
      ?.rotation ?? 0;
  const swap = Math.abs(Math.round(rotation)) % 180 === 90;

  const duration = Number(data.format?.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("ffprobe could not read the duration");

  return {
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    duration,
    hasAudio: streams.some((stream) => stream.codec_type === "audio"),
  };
}

function videoTargetSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const scale = Math.min(1, MAX_VIDEO_HEIGHT / height);
  // Floor to even numbers: H.264 with yuv420p needs both dimensions even, and flooring
  // guarantees we never upscale the source.
  return {
    width: Math.max(2, Math.floor((width * scale) / 2) * 2),
    height: Math.max(2, Math.floor((height * scale) / 2) * 2),
  };
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], {
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    const tail = stderr.trim().split("\n").slice(-4).join(" | ");
    throw new Error(
      `ffmpeg failed${tail ? `: ${tail}` : `: ${errorMessage(error)}`}`,
    );
  }
}

function scaleFilter(size: { width: number; height: number }): string {
  return `scale=${size.width}:${size.height}:flags=lanczos,setsar=1`;
}

/**
 * HLS is worth it for a clip a reader will actually watch for a while: the
 * ladder costs several extra encodes and uploads. `--hls` / `--no-hls` override
 * the duration rule; the boundary itself is exclusive (20 s stays one MP4).
 */
export function shouldUseHls(
  duration: number,
  flags: { hls: boolean; noHls: boolean },
): boolean {
  if (flags.hls) return true;
  if (flags.noHls) return false;
  return duration > HLS_MIN_DURATION;
}

/**
 * The rungs that fit a source, tallest first. Never upscales: a 720p source gets
 * 720 and 480, and anything under 480 keeps one rung at its own even height.
 */
export function hlsRungs(srcHeight: number): HlsRung[] {
  const height = Math.max(2, Math.floor(srcHeight / 2) * 2);
  const fits = HLS_LADDER.filter((rung) => rung.height <= height);
  if (fits.length > 0) return fits.map((rung) => ({ ...rung }));
  return [{ height, ...HLS_SMALL_RUNG }];
}

/** The rung's output size, keeping the source's aspect ratio. */
function rungSize(
  width: number,
  height: number,
  rungHeight: number,
): { width: number; height: number } {
  return {
    width: Math.max(2, Math.floor((width * rungHeight) / height / 2) * 2),
    height: rungHeight,
  };
}

async function listFilesRecursive(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full, base)));
    } else {
      files.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function contentTypeFor(file: string): string {
  if (file.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  return "video/mp4";
}

/** `BANDWIDTH` and `RESOLUTION` from the master playlist, tallest first. */
function readMasterLevels(
  master: string,
): { height: number; bandwidth: number }[] {
  const levels: { height: number; bandwidth: number }[] = [];
  for (const line of master.split("\n")) {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const bandwidth = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0);
    const height = Number(/RESOLUTION=\d+x(\d+)/.exec(line)?.[1] ?? 0);
    if (height > 0) levels.push({ height, bandwidth });
  }
  return levels;
}

interface HlsOutput {
  /** Paths relative to `<id>/hls/`, body and content type ready to upload. */
  files: { relative: string; body: Buffer; contentType: string }[];
  bytes: number;
  levels: { height: number; bandwidth: number }[];
}

/**
 * One ffmpeg run for the whole ladder: split, scale per rung, encode each with
 * the same 2 s keyframe grid, and let the HLS muxer write one playlist per rung
 * plus the master that lists them.
 */
async function encodeHls(
  job: Job,
  probe: ProbeResult,
  rungs: HlsRung[],
  workDir: string,
  audio: boolean,
): Promise<HlsOutput> {
  const hlsDir = path.join(workDir, "hls");
  await mkdir(hlsDir, { recursive: true });
  for (let index = 0; index < rungs.length; index++) {
    await mkdir(path.join(hlsDir, `v${index}`), { recursive: true });
  }

  const sizes = rungs.map((rung) =>
    rungSize(probe.width, probe.height, rung.height),
  );
  const filters = sizes
    .map((size, index) => `[v${index}]${scaleFilter(size)}[vout${index}]`)
    .join(";");

  const args: string[] = [
    "-i",
    job.file,
    "-filter_complex",
    `[0:v]split=${rungs.length}${rungs.map((_, index) => `[v${index}]`).join("")};${filters}`,
  ];

  for (let index = 0; index < rungs.length; index++) {
    args.push("-map", `[vout${index}]`);
    if (audio) args.push("-map", "0:a:0");
  }

  args.push(
    "-c:v",
    "libx264",
    "-crf",
    "21",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
  );
  for (const [index, rung] of rungs.entries()) {
    args.push(
      `-maxrate:v:${index}`,
      rung.maxrate,
      `-bufsize:v:${index}`,
      rung.bufsize,
    );
  }
  args.push(
    "-force_key_frames",
    "expr:gte(t,n_forced*2)",
    "-sc_threshold",
    "0",
  );
  if (audio) args.push("-c:a", "aac", "-b:a", "128k");

  // The HLS muxer expands %v per variant, so it needs a directory per rung; the
  // playlist name doubles as the segment path base. Forward slashes keep the
  // playlist URIs portable.
  const base = hlsDir.split(path.sep).join("/");
  args.push(
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_type",
    "fmp4",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_filename",
    `${base}/v%v/segment_%d.m4s`,
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    rungs
      .map((_, index) => (audio ? `v:${index},a:${index}` : `v:${index}`))
      .join(" "),
    `${base}/v%v/index.m3u8`,
  );

  await runFfmpeg(args);

  const relatives = await listFilesRecursive(hlsDir);
  const files = await Promise.all(
    relatives.map(async (relative) => {
      const body = await readFile(path.join(hlsDir, relative));
      return { relative, body, contentType: contentTypeFor(relative) };
    }),
  );
  const master = await readFile(path.join(hlsDir, "master.m3u8"), "utf8");

  return {
    files,
    bytes: files.reduce((total, file) => total + file.body.byteLength, 0),
    levels: readMasterLevels(master),
  };
}

async function processVideo(
  job: Job,
  alt: string,
  caption: string,
  options: CliOptions,
  workDir: string,
): Promise<VideoMedia> {
  const probe = await probeVideo(job.file);
  const useHls = shouldUseHls(probe.duration, options);
  const rungs = useHls ? hlsRungs(probe.height) : [];
  const ladderSize =
    rungs.length > 0
      ? rungSize(probe.width, probe.height, rungs[0].height)
      : undefined;
  const size = ladderSize ?? videoTargetSize(probe.width, probe.height);
  // The progressive MP4 is the fallback for an HLS clip, so it encodes at the
  // lowest rung instead of duplicating the top one.
  const fallbackRung = rungs.at(-1);
  const mp4Size = fallbackRung
    ? rungSize(probe.width, probe.height, fallbackRung.height)
    : size;

  // Check the poster timestamp before encoding: a bad value should fail fast instead of
  // after a slow encode, and before any upload has happened.
  if (options.posterAt >= probe.duration) {
    throw new Error(
      `--poster-at ${options.posterAt} is past the ${probe.duration.toFixed(2)}s duration`,
    );
  }

  console.log(
    `  info     ${probe.width}x${probe.height} · ${probe.duration.toFixed(2)}s · audio: ${probe.hasAudio ? "yes" : "no"} → ${size.width}x${size.height}${useHls ? " (HLS)" : ""}`,
  );

  const mp4Path = path.join(workDir, "video.mp4");
  const audioArgs = options.audio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"];

  await runFfmpeg([
    "-i",
    job.file,
    "-vf",
    scaleFilter(mp4Size),
    "-c:v",
    "libx264",
    "-crf",
    useHls ? "21" : "20",
    ...(fallbackRung
      ? ["-maxrate", fallbackRung.maxrate, "-bufsize", fallbackRung.bufsize]
      : []),
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    ...audioArgs,
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  const mp4 = await readFile(mp4Path);

  // The cap guards a full-size MP4 a reader downloads whole. An HLS fallback is
  // already at the lowest rung, and the ladder has its own budget below.
  if (!useHls) {
    if (mp4.byteLength > MP4_MAX_BYTES) {
      throw new Error(
        `the MP4 is ${formatBytes(mp4.byteLength)}, over the 10 MB cap. Re-encode with a higher CRF or use a shorter clip.`,
      );
    }
    if (mp4.byteLength > MP4_WARN_BYTES) {
      console.warn(
        `  warn     MP4 is ${formatBytes(mp4.byteLength)} — over 6 MB, consider a higher CRF or a shorter clip`,
      );
    }
  }

  let hls: HlsOutput | undefined;
  if (useHls) {
    hls = await encodeHls(job, probe, rungs, workDir, options.audio);
    if (hls.bytes > HLS_MAX_BYTES) {
      throw new Error(
        `the HLS ladder is ${formatBytes(hls.bytes)}, over the 150 MB cap. Raise the CRF or trim the clip.`,
      );
    }
    if (hls.bytes > HLS_WARN_BYTES) {
      console.warn(
        `  warn     HLS ladder is ${formatBytes(hls.bytes)} — over 60 MB, consider a higher CRF or a shorter clip`,
      );
    }
    for (const level of hls.levels) {
      console.log(
        `  info     hls ${level.height}p · ${Math.round(level.bandwidth / 1000)} kbps`,
      );
    }
  }

  let webmBuffer: Buffer | undefined;
  if (options.webm) {
    const webmPath = path.join(workDir, "video.webm");
    await runFfmpeg([
      "-i",
      job.file,
      "-vf",
      scaleFilter(mp4Size),
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "33",
      "-b:v",
      "0",
      "-row-mt",
      "1",
      "-deadline",
      "good",
      "-cpu-used",
      "2",
      ...(options.audio ? ["-c:a", "libopus", "-b:a", "96k"] : ["-an"]),
      webmPath,
    ]);
    webmBuffer = await readFile(webmPath);
  }

  const posterPng = path.join(workDir, "poster.png");
  await runFfmpeg([
    "-ss",
    String(options.posterAt),
    "-i",
    job.file,
    "-frames:v",
    "1",
    "-vf",
    scaleFilter(size),
    "-update",
    "1",
    posterPng,
  ]);

  const poster = sharp(posterPng);
  const [posterAvif, posterJpg] = await Promise.all([
    poster.clone().avif({ quality: 55 }).toBuffer(),
    poster.clone().jpeg({ quality: 82 }).toBuffer(),
  ]);

  // Every HLS file lands under `media/<id>/hls/`, so the master's relative
  // variant URIs keep working straight from Blob.
  let hlsUrl: string | undefined;
  if (hls) {
    const urls = await publishAll(job.id, hls.files, options.dryRun);
    hlsUrl = urls.get("master.m3u8");
  }

  let webm: { url: string; bytes: number } | undefined;
  if (webmBuffer) {
    webm = {
      url: await publish(
        `media/${job.id}/video.webm`,
        webmBuffer,
        "video/webm",
        options.dryRun,
      ),
      bytes: webmBuffer.byteLength,
    };
  }

  return {
    id: job.id,
    kind: "video",
    width: size.width,
    height: size.height,
    alt,
    caption,
    createdAt: new Date().toISOString(),
    original: job.name,
    mp4: {
      url: await publish(
        `media/${job.id}/video.mp4`,
        mp4,
        "video/mp4",
        options.dryRun,
      ),
      bytes: mp4.byteLength,
    },
    ...(webm ? { webm } : {}),
    ...(hls && hlsUrl
      ? { hls: { url: hlsUrl, bytes: hls.bytes, levels: hls.levels } }
      : {}),
    poster: {
      avif: await publish(
        `media/${job.id}/poster.avif`,
        posterAvif,
        "image/avif",
        options.dryRun,
      ),
      jpg: await publish(
        `media/${job.id}/poster.jpg`,
        posterJpg,
        "image/jpeg",
        options.dryRun,
      ),
    },
    duration: Number(probe.duration.toFixed(2)),
    // The manifest describes the encode, not the source: without --audio the MP4 has
    // no audio stream even when the original did.
    hasAudio: options.audio && probe.hasAudio,
  };
}

/* -------------------------------------------------------------------------- */
/* Alt text                                                                   */
/* -------------------------------------------------------------------------- */

async function collectAltText(
  names: string[],
  singleAlt: string | undefined,
): Promise<string[]> {
  if (singleAlt !== undefined) {
    if (names.length === 1) return [singleAlt];
    console.warn(
      `  warn     --alt ignored: ${names.length} files are pending, so alt text is collected per file`,
    );
  }

  if (names.length === 0) return [];

  if (!process.stdin.isTTY) {
    console.warn(
      "  warn     stdin is not a TTY — alt text is empty for this run. Re-run with --alt or from a terminal.",
    );
    return names.map(() => "");
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answers: string[] = [];
    for (const name of names) {
      answers.push((await readline.question(`Alt text for ${name}: `)).trim());
    }
    return answers;
  } finally {
    readline.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function listInbox(): Promise<string[]> {
  await mkdir(INBOX_DIR, { recursive: true });
  const entries = await readdir(INBOX_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function run(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }
  if (options.study !== undefined) assertStudySlug(options.study);

  loadEnv();

  // OIDC tokens expire ~12 h after `vercel env pull`, so refresh a stale .env.blob
  // before encoding starts rather than failing mid-upload. A BLOB_READ_WRITE_TOKEN
  // needs no refresh, and --dry-run never uploads.
  if (!options.dryRun && !process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await refreshBlobEnv(ROOT);
    } catch (error) {
      console.error(`fail     ${errorMessage(error)}`);
      return 1;
    }
  }

  if (!options.dryRun && !hasBlobAuth()) {
    console.error(
      "fail     no Blob credentials: expected BLOB_STORE_ID + VERCEL_OIDC_TOKEN in .env.blob, or BLOB_READ_WRITE_TOKEN.\n" +
        `         ${AUTH_HINT}\n` +
        "         (--dry-run works without credentials.)",
    );
    return 1;
  }

  await mkdir(MANIFEST_DIR, { recursive: true });
  await mkdir(ARCHIVE_DIR, { recursive: true });

  const names = await listInbox();
  if (names.length === 0) {
    console.log("Inbox is empty — drop files in media/inbox/ and run again.");
    return 0;
  }

  const jobs: Job[] = [];
  for (const name of names) {
    const ext = path.extname(name).slice(1).toLowerCase();
    const kind = IMAGE_EXTENSIONS.has(ext)
      ? "image"
      : VIDEO_EXTENSIONS.has(ext)
        ? "video"
        : null;
    if (!kind) {
      console.warn(`skip     ${name} — unsupported extension`);
      continue;
    }

    const file = path.join(INBOX_DIR, name);
    const id = await mediaId(file, name);

    if (existsSync(path.join(MANIFEST_DIR, `${id}.json`))) {
      console.log(`skip     ${name} — content/media/${id}.json already exists`);
      continue;
    }

    jobs.push({ name, file, ext, kind, id });
  }

  if (jobs.length === 0) return 0;

  const alts = await collectAltText(
    jobs.map((job) => job.name),
    options.alt,
  );

  const workRoot = await mkdtemp(path.join(tmpdir(), "media-post-"));
  const written: MediaManifest[] = [];
  let failures = 0;

  try {
    for (const [index, job] of jobs.entries()) {
      const alt = alts[index] ?? "";
      const caption = options.post ?? "";

      try {
        const workDir = path.join(workRoot, job.id);
        await mkdir(workDir, { recursive: true });

        const manifest =
          job.kind === "image"
            ? await processImage(job, alt, caption, options.dryRun)
            : await processVideo(job, alt, caption, options, workDir);

        const manifestPath = path.join(MANIFEST_DIR, `${job.id}.json`);

        if (options.dryRun) {
          console.log(`  dry-run  would write content/media/${job.id}.json`);
        } else {
          await writeFile(
            manifestPath,
            `${JSON.stringify(manifest, null, 2)}\n`,
            "utf8",
          );
          const archivePath = path.join(ARCHIVE_DIR, `${job.id}.${job.ext}`);
          await rename(job.file, archivePath);
          console.log(
            `ok       ${job.name} → ${job.id} (archived as media/archive/${job.id}.${job.ext})`,
          );
        }

        written.push(manifest);
      } catch (error) {
        failures++;
        console.error(`fail     ${job.name} — ${errorMessage(error)}`);
      }
    }

    if (options.post !== undefined && written.length > 0 && !options.dryRun) {
      await writePost(
        options.post,
        written.map((manifest) => manifest.id),
      );
    } else if (options.post !== undefined && written.length > 0) {
      console.log(`  dry-run  would write a post for ${written.length} id(s)`);
    }

    if (options.study !== undefined && written.length > 0) {
      console.log(`Paste into content/work/${options.study}.mdx:`);
      for (const manifest of written) {
        console.log(
          `<Figure caption=""><Media id="${manifest.id}" /></Figure>`,
        );
      }
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`${failures} file(s) failed; ${written.length} succeeded.`);
    return 1;
  }
  console.log(
    `${written.length} file(s) ingested${options.dryRun ? " (dry run)" : ""}.`,
  );
  return 0;
}

async function writePost(caption: string, ids: string[]): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(caption) || "post";
  const target = path.join(POSTS_DIR, `${date}-${slug}.mdx`);

  await mkdir(POSTS_DIR, { recursive: true });
  if (existsSync(target)) {
    console.warn(
      `warn     content/posts/${path.basename(target)} already exists — leaving it untouched`,
    );
    return;
  }

  const frontmatter = [
    "---",
    `date: ${date}`,
    `caption: ${JSON.stringify(caption)}`,
    `media: [${ids.map((id) => JSON.stringify(id)).join(", ")}]`,
    "---",
    "",
    "",
  ].join("\n");

  await writeFile(target, frontmatter, "utf8");
  console.log(`post     content/posts/${path.basename(target)}`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      if (error instanceof UsageError) {
        console.error(`${error.message}\n`);
        printHelp();
        process.exitCode = 2;
        return;
      }
      console.error(errorMessage(error));
      process.exitCode = 1;
    });
}
