#!/usr/bin/env node
/**
 * `pnpm media:migrate-r2` — re-encode the archived originals, upload them to
 * Cloudflare R2 and point every manifest at the public R2 URL.
 *
 * For each manifest in `content/media` it:
 *   1. finds the local original in the `--archive` directories,
 *   2. proves the original still hashes to the manifest id,
 *   3. copies it into `media/inbox/` under the manifest's original name,
 *   4. runs `scripts/post.ts --only ... --force` so the ids and keys stay the same,
 *   5. HEADs every object and skips ones already in R2, then
 *   6. rewrites the manifest URLs to `R2_PUBLIC_BASE_URL` and restores `createdAt`.
 *
 * A manifest with no local original is listed as missing and skipped. Blob is
 * never read: the originals are local.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { MediaManifest } from "../src/lib/media-types";
import { loadR2Env, type R2Env } from "./lib/r2-env.ts";
import { HLS_MIN_DURATION } from "./lib/media-encoding.ts";
import { mediaIdFor } from "./lib/media-id.ts";

const ROOT = process.cwd();
const MANIFEST_DIR = path.join(ROOT, "content", "media");
const INBOX_DIR = path.join(ROOT, "media", "inbox");
const POST_SCRIPT = path.join(ROOT, "scripts", "post.ts");

class UsageError extends Error {}

interface CliOptions {
  archives: string[];
  dryRun: boolean;
  local: boolean;
  only?: string;
  help: boolean;
}

export interface ArchiveFile {
  /** The directory as passed on the command line, resolved. */
  dir: string;
  name: string;
  path: string;
  bytes: number;
}

export type PlanStatus = "migrate" | "missing";

export interface ManifestPlan {
  id: string;
  kind: MediaManifest["kind"];
  original: string;
  manifestPath: string;
  status: PlanStatus;
  source?: ArchiveFile;
  /** URLs in the manifest; HLS counts its master playlist only. */
  objects: number;
  /** Sum of the manifest's recorded `bytes` fields. */
  recordedBytes: number;
  /** Recorded bytes behind HLS (already included in recordedBytes). */
  hlsBytes: number;
}

export interface MigrationPlan {
  manifests: ManifestPlan[];
  totals: {
    manifests: number;
    video: number;
    image: number;
    migrate: number;
    missing: number;
    objects: number;
    recordedBytes: number;
    sourceBytes: number;
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    archives: [],
    dryRun: false,
    local: false,
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
      case "--archive":
        options.archives.push(value());
        break;
      case "--only":
        options.only = value();
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--local":
        options.local = true;
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

  if (options.archives.length === 0) {
    throw new UsageError(
      "pass at least one --archive <dir>; nothing is hard-coded",
    );
  }
  if (options.only !== undefined && options.only.trim() === "") {
    throw new UsageError("--only needs a manifest id");
  }

  return options;
}

function printHelp(): void {
  console.log(`pnpm media:migrate-r2 — move media from Blob to Cloudflare R2

Usage
  pnpm media:migrate-r2 --archive <dir> [--archive <dir> ...] [options]

Every content/media/<id>.json needs its local original. Pass every archive
directory that may hold one; the first match wins. The original is copied into
media/inbox/ (never moved or deleted), re-encoded with the existing pipeline so
the id and key layout stay identical, uploaded to R2, and the manifest URLs are
rewritten to R2_PUBLIC_BASE_URL. Existing R2 objects are skipped by HEAD.

Options
  --archive <dir>   Repeatable. Example:
                    --archive media/archive
                    --archive C:/Users/Dat/orca/workspaces/portfolio/drag-canvas/media/archive
                    --archive C:/Users/Dat/orca/portfolio/media/archive
  --dry-run         Print the plan (manifests, objects, bytes) and stop.
                    No S3 client, no HEAD, no upload, no network.
  --local           Also mirror every uploaded object into media/local/ for
                    MEDIA_ORIGIN=local (the manifest still records R2 URLs).
  --only <id>       Migrate one manifest id; the rest are left alone.
  --help, -h        Show this help.

Environment
  Reads .env.r2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_BASE_URL. Missing keys are named; values are never
  printed. --dry-run needs no credentials. Blob is never contacted.
`);
}

function listArchive(dir: string): ArchiveFile[] {
  if (!existsSync(dir)) {
    throw new UsageError(`archive directory does not exist: ${dir}`);
  }

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => {
      const file = path.join(dir, entry.name);
      return {
        dir,
        name: entry.name,
        path: file,
        bytes: statSync(file).size,
      };
    });
}

function normalizeName(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

/**
 * Exact original filename first, then the pipeline's archived name
 * `<id><original extension>`. `media/archive` uses the latter; the main
 * checkout's lone image uses the former.
 */
export function findOriginal(
  manifest: MediaManifest,
  archives: ArchiveFile[],
): ArchiveFile | undefined {
  const byName = new Map(
    archives.map((file) => [normalizeName(file.name), file]),
  );
  const exact = byName.get(normalizeName(manifest.original));
  if (exact) return exact;

  const extension = path.extname(manifest.original).toLowerCase();
  return byName.get(normalizeName(`${manifest.id}${extension}`));
}

function countUrls(value: unknown): number {
  if (typeof value === "string") return value.startsWith("https://") ? 1 : 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + countUrls(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>(
      (total, item) => total + countUrls(item),
      0,
    );
  }
  return 0;
}

function sumRecordedBytes(value: unknown, key = ""): number {
  if (typeof value === "number" && key === "bytes") return value;
  if (Array.isArray(value)) {
    return value.reduce<number>(
      (total, item) => total + sumRecordedBytes(item),
      0,
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<number>(
      (total, [childKey, child]) => total + sumRecordedBytes(child, childKey),
      0,
    );
  }
  return 0;
}

export function planMigration(
  manifests: MediaManifest[],
  archives: ArchiveFile[],
): MigrationPlan {
  const planned = manifests.map<ManifestPlan>((manifest) => {
    const source = findOriginal(manifest, archives);
    const status: PlanStatus = source ? "migrate" : "missing";

    return {
      id: manifest.id,
      kind: manifest.kind,
      original: manifest.original,
      manifestPath: path.join(MANIFEST_DIR, `${manifest.id}.json`),
      status,
      ...(source ? { source } : {}),
      objects: countUrls(manifest),
      recordedBytes: sumRecordedBytes(manifest),
      hlsBytes: manifest.kind === "video" ? (manifest.hls?.bytes ?? 0) : 0,
    };
  });

  return {
    manifests: planned,
    totals: {
      manifests: planned.length,
      video: planned.filter((item) => item.kind === "video").length,
      image: planned.filter((item) => item.kind === "image").length,
      migrate: planned.filter((item) => item.status === "migrate").length,
      missing: planned.filter((item) => item.status === "missing").length,
      objects: planned.reduce((total, item) => total + item.objects, 0),
      recordedBytes: planned.reduce(
        (total, item) => total + item.recordedBytes,
        0,
      ),
      sourceBytes: planned.reduce(
        (total, item) => total + (item.source?.bytes ?? 0),
        0,
      ),
    },
  };
}

export function readManifests(dir = MANIFEST_DIR): MediaManifest[] {
  if (!existsSync(dir)) {
    throw new UsageError(`no manifest directory: ${dir}`);
  }

  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const id = file.slice(0, -".json".length);
      const raw: unknown = JSON.parse(
        readFileSync(path.join(dir, file), "utf8"),
      );
      if (
        typeof raw !== "object" ||
        raw === null ||
        (raw as { id?: unknown }).id !== id
      ) {
        throw new Error(`content/media/${file} does not declare id "${id}"`);
      }
      const manifest = raw as MediaManifest;
      if (manifest.kind !== "image" && manifest.kind !== "video") {
        throw new Error(`content/media/${file} has an unknown kind`);
      }
      if (typeof manifest.original !== "string") {
        throw new Error(`content/media/${file} has no original filename`);
      }
      return manifest;
    });
}

/** Typed URL rewrite so a caption that starts with `https://` is untouched. */
export function rewriteManifestUrls(
  manifest: MediaManifest,
  publicBaseUrl: string,
): MediaManifest {
  const base = publicBaseUrl.replace(/\/+$/, "");
  const rewrite = (url: string): string => {
    const parsed = new URL(url);
    return `${base}${parsed.pathname}${parsed.search}`;
  };

  if (manifest.kind === "image") {
    return {
      ...manifest,
      sources: manifest.sources.map((source) => ({
        ...source,
        url: rewrite(source.url),
      })),
    };
  }

  return {
    ...manifest,
    mp4: { ...manifest.mp4, url: rewrite(manifest.mp4.url) },
    ...(manifest.webm
      ? { webm: { ...manifest.webm, url: rewrite(manifest.webm.url) } }
      : {}),
    ...(manifest.canvas
      ? {
          canvas: {
            ...manifest.canvas,
            url: rewrite(manifest.canvas.url),
          },
        }
      : {}),
    ...(manifest.hls
      ? { hls: { ...manifest.hls, url: rewrite(manifest.hls.url) } }
      : {}),
    poster: {
      avif: rewrite(manifest.poster.avif),
      jpg: rewrite(manifest.poster.jpg),
    },
  };
}

function printPlan(plan: MigrationPlan): void {
  console.log("R2 migration plan (dry run)");
  console.log(
    `  manifests  ${plan.totals.manifests} (${plan.totals.video} video, ${plan.totals.image} image)`,
  );
  console.log(
    `  migrate    ${plan.totals.migrate}  missing ${plan.totals.missing}`,
  );
  console.log(
    `  objects    ${plan.totals.objects} manifest URLs (HLS counted by master playlist only)`,
  );
  console.log(
    `  bytes      ${plan.totals.recordedBytes} recorded (${formatBytes(plan.totals.recordedBytes)}), ${plan.totals.sourceBytes} originals (${formatBytes(plan.totals.sourceBytes)})`,
  );

  for (const item of plan.manifests) {
    const label = item.status === "migrate" ? "migrate " : "missing ";
    const source = item.source ? ` <- ${item.source.path}` : "";
    console.log(
      `  ${label} ${item.id}  ${item.kind}  ${item.objects} objects  ${formatBytes(item.recordedBytes)}${source}`,
    );
  }

  console.log(
    "  dry run: no S3 client, no HEAD, no upload, no network, no Blob request.",
  );
}

function postArgs(manifest: MediaManifest, options: CliOptions): string[] {
  const args = [
    POST_SCRIPT,
    "--only",
    manifest.original,
    "--force",
    "--skip-existing",
    "--no-archive",
    `--alt=${manifest.alt}`,
    `--caption=${manifest.caption}`,
  ];

  if (options.local) args.push("--mirror-local");

  if (manifest.kind === "video") {
    if (manifest.hasAudio) args.push("--audio");
    if (manifest.webm) args.push("--webm");
    if (manifest.hls) {
      args.push("--hls");
    } else if (manifest.duration > HLS_MIN_DURATION) {
      args.push("--no-hls");
    }
  }

  return args;
}

async function sameContents(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([readFile(left), readFile(right)]);
  return a.equals(b);
}

async function runPost(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `scripts/post.ts exited ${code === null ? `on signal ${signal}` : `with code ${code}`}`,
        ),
      );
    });
  });
}

async function migrateOne(
  item: ManifestPlan,
  options: CliOptions,
  env: R2Env,
): Promise<void> {
  if (!item.source) throw new Error("no local original");
  if (path.basename(item.original) !== item.original) {
    throw new Error(`original is not a basename: ${item.original}`);
  }

  const originalBytes = readFileSync(item.source.path);
  const expectedId = mediaIdFor(item.original, originalBytes);
  if (expectedId !== item.id) {
    throw new Error(
      `original hashes to ${expectedId}, not ${item.id}; refusing to change the id`,
    );
  }

  await mkdir(INBOX_DIR, { recursive: true });
  const staged = path.join(INBOX_DIR, item.original);
  if (existsSync(staged)) {
    if (!(await sameContents(staged, item.source.path))) {
      throw new Error(
        `media/inbox/${item.original} already exists with different bytes; clear it first`,
      );
    }
    await rm(staged);
  }

  await copyFile(item.source.path, staged);
  try {
    const old = JSON.parse(
      await readFile(item.manifestPath, "utf8"),
    ) as MediaManifest;

    await runPost(postArgs(old, options));

    const written = JSON.parse(
      await readFile(item.manifestPath, "utf8"),
    ) as MediaManifest;
    if (written.id !== item.id) {
      throw new Error(`pipeline wrote ${written.id} instead of ${item.id}`);
    }
    if (written.original !== item.original) {
      throw new Error(
        `pipeline recorded original "${written.original}" instead of "${item.original}"`,
      );
    }

    const rewritten = rewriteManifestUrls(written, env.publicBaseUrl);
    rewritten.createdAt = old.createdAt;
    await writeFile(
      item.manifestPath,
      `${JSON.stringify(rewritten, null, 2)}\n`,
      "utf8",
    );
    console.log(
      `  rewrite  content/media/${item.id}.json -> ${env.publicBaseUrl}`,
    );
  } finally {
    await rm(staged, { force: true });
  }
}

async function run(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  const archiveDirs = options.archives.map((dir) => path.resolve(ROOT, dir));
  const archives = archiveDirs.flatMap(listArchive);

  const manifests = readManifests().filter(
    (manifest) => options.only === undefined || manifest.id === options.only,
  );
  if (manifests.length === 0) {
    throw new UsageError(
      options.only
        ? `no manifest for id "${options.only}"`
        : "no manifests in content/media",
    );
  }

  const plan = planMigration(manifests, archives);
  if (options.dryRun) {
    printPlan(plan);
    return 0;
  }

  const env = loadR2Env(ROOT);
  console.log(
    `R2 migration: ${plan.totals.migrate} manifests, ${archiveDirs.length} archive directory(ies)`,
  );

  let failures = 0;
  for (const item of plan.manifests) {
    if (item.status !== "migrate") {
      console.log(`  skip     ${item.id} - missing local original`);
      continue;
    }

    try {
      await migrateOne(item, options, env);
      console.log(`  ok       ${item.id}`);
    } catch (error) {
      failures++;
      console.error(`  fail     ${item.id} — ${errorMessage(error)}`);
    }
  }

  if (failures > 0) {
    console.error(
      `${failures} manifest(s) failed; ${plan.totals.migrate - failures} migrated.`,
    );
    return 1;
  }

  console.log(`Migrated ${plan.totals.migrate} manifest(s) to R2.`);
  return 0;
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
