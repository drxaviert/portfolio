/**
 * Storage adapter for the media pipeline.
 *
 * `pnpm post` writes content-addressed keys under `media/<id>/`; this module
 * turns one of those keys into a public URL and uploads the bytes to R2 over
 * the S3 API. The same interface covers dry runs and local-output runs, which
 * is what keeps `--dry-run` network-free.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { contentTypeFor } from "../../src/lib/media-content-types.ts";
import type { R2Env } from "./r2-env.ts";

/**
 * One year, immutable. The `<id>` prefix is content-addressed by the original
 * bytes (`slug-sha256[:10]`), so re-running the pipeline for the same original
 * rewrites the same keys with the same inputs. Individual file names such as
 * `video.mp4` are not hashes, but the directory is the cache key.
 */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface MediaUpload {
  /** Object key, e.g. `media/<id>/video.mp4`. */
  key: string;
  body: Buffer;
}

export interface MediaStore {
  readonly kind: "r2" | "dry-run" | "local";
  /** Public URL for a key; used when writing the manifest. */
  urlFor(key: string): string;
  /** HEADs a key. Returns false on 404, throws on any other failure. */
  head(key: string): Promise<boolean>;
  /**
   * Uploads one object. With `skipExisting`, an existing key is left alone and
   * the same public URL is returned, which makes a migration re-run safe.
   */
  put(upload: MediaUpload): Promise<{ url: string; skipped: boolean }>;
}

/** The subset of `S3Client.send` the store needs; tests pass a fake. */
export interface S3Sender {
  send(command: unknown): Promise<unknown>;
}

interface R2StoreOptions {
  /** HEAD every key before PUT; used by the migration. */
  skipExisting?: boolean;
  /** Injected in tests. When absent the store builds an S3 client. */
  client?: S3Sender;
  /** Also write each object under this root (the migration's --local). */
  mirrorRoot?: string;
}

function isNotFound(error: unknown): boolean {
  const named = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    named.name === "NotFound" ||
    named.Code === "NotFound" ||
    named.$metadata?.httpStatusCode === 404
  );
}

function uploadUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

/** The S3 endpoint Cloudflare publishes for an account. */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

async function writeLocalObject(
  root: string,
  key: string,
  body: Buffer,
): Promise<void> {
  const target = path.join(root, ...key.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export function createR2Store(
  env: R2Env,
  options: R2StoreOptions = {},
): MediaStore {
  const client =
    options.client ??
    new S3Client({
      region: "auto",
      endpoint: r2Endpoint(env.accountId),
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });

  const head = async (key: string): Promise<boolean> => {
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: env.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  };

  return {
    kind: "r2",
    urlFor: (key) => uploadUrl(env.publicBaseUrl, key),
    head,
    async put({ key, body }) {
      const url = uploadUrl(env.publicBaseUrl, key);
      if (options.skipExisting && (await head(key))) {
        console.log(`  skip     ${key} (already in R2)`);
        if (options.mirrorRoot) {
          await writeLocalObject(options.mirrorRoot, key, body);
        }
        return { url, skipped: true };
      }

      await client.send(
        new PutObjectCommand({
          Bucket: env.bucket,
          Key: key,
          Body: body,
          ContentType: contentTypeFor(key),
          CacheControl: MEDIA_CACHE_CONTROL,
        }),
      );
      console.log(`  upload   ${key} (${formatBytes(body.byteLength)})`);
      if (options.mirrorRoot) {
        await writeLocalObject(options.mirrorRoot, key, body);
        console.log(`  local    ${key} (mirrored)`);
      }
      return { url, skipped: false };
    },
  };
}

/**
 * Plans and logs every upload, then returns the URL the manifest would record.
 * No client is constructed: `--dry-run` must not open a socket.
 */
export function createDryRunStore(): MediaStore {
  const base = "https://dry-run.invalid";
  return {
    kind: "dry-run",
    urlFor: (key) => uploadUrl(base, key),
    head: async () => false,
    async put({ key, body }) {
      console.log(
        `  dry-run  would upload ${key} (${contentTypeFor(key)}, ${formatBytes(body.byteLength)})`,
      );
      return { url: uploadUrl(base, key), skipped: false };
    },
  };
}

interface LocalStoreOptions {
  root: string;
  /** Public URLs still go in the manifest; the files are served locally. */
  publicBaseUrl: string;
}

/**
 * `--local` writes the encoded files to `media/local/<key>` instead of R2. The
 * manifest still records the production URL; `MEDIA_ORIGIN=local` rewrites it
 * to `/media/local/<key>` when the dev server reads the manifest.
 */
export function createLocalStore({
  root,
  publicBaseUrl,
}: LocalStoreOptions): MediaStore {
  const localRoot = path.join(root, "media", "local");
  return {
    kind: "local",
    urlFor: (key) => uploadUrl(publicBaseUrl, key),
    head: async () => false,
    async put({ key, body }) {
      await writeLocalObject(localRoot, key, body);
      console.log(`  local    ${key} (${formatBytes(body.byteLength)})`);
      return { url: uploadUrl(publicBaseUrl, key), skipped: false };
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
