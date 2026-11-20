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

interface CliOptions {
  alt?: string;
  post?: string;
  study?: string;
  audio: boolean;
  webm: boolean;
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

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    audio: false,
    webm: false,
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
  --study <slug>        Print a <Figure>/<Media> snippet for each ingested id.
  --audio               Keep audio in the encoded video (AAC 128k).
  --webm                Also encode a VP9 WebM alongside the MP4.
  --poster-at <sec>     Poster frame timestamp in seconds. Default: 0.
  --dry-run             Encode and report, but do not upload or write anything.
  --help, -h            Show this help.

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

async function processVideo(
  job: Job,
  alt: string,
  caption: string,
  options: CliOptions,
  workDir: string,
): Promise<VideoMedia> {
  const probe = await probeVideo(job.file);
  const size = videoTargetSize(probe.width, probe.height);

  console.log(
    `  info     ${probe.width}x${probe.height} · ${probe.duration.toFixed(2)}s · audio: ${probe.hasAudio ? "yes" : "no"} → ${size.width}x${size.height}`,
  );

  const mp4Path = path.join(workDir, "video.mp4");
  const audioArgs = options.audio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"];

  await runFfmpeg([
    "-i",
    job.file,
    "-vf",
    scaleFilter(size),
    "-c:v",
    "libx264",
    "-crf",
    "20",
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

  let webm: { url: string; bytes: number } | undefined;
  if (options.webm) {
    const webmPath = path.join(workDir, "video.webm");
    await runFfmpeg([
      "-i",
      job.file,
      "-vf",
      scaleFilter(size),
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
    const webmBuffer = await readFile(webmPath);
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

  if (options.posterAt >= probe.duration) {
    throw new Error(
      `--poster-at ${options.posterAt} is past the ${probe.duration.toFixed(2)}s duration`,
    );
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
    hasAudio: probe.hasAudio,
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

    if (options.study !== undefined) {
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
