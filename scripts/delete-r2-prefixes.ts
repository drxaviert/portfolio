#!/usr/bin/env node
/**
 * Delete the seven R2 media prefixes that the 2026-11-24 replacement retired.
 *
 * This is the only destructive R2 command in the repo. It is deliberately
 * narrow: the prefixes are hard-coded, every listed key must sit under one of
 * them, and `--apply` refuses to run while one of the old manifests is still in
 * `content/media/`. The default is a read-only dry run.
 *
 * Usage:
 *   pnpm media:delete-r2            # list the objects, delete nothing
 *   pnpm media:delete-r2 --dry-run  # the same, explicit
 *   pnpm media:delete-r2 --apply    # delete after the PR is merged/deployed
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { r2Endpoint } from "./lib/media-store.ts";
import { loadR2Env } from "./lib/r2-env.ts";

const ROOT = process.cwd();

/** The 7 ids approved by Dat on 2026-11-24 (pf-3xh.8). */
export const RETIRED_MEDIA_IDS = [
  "docebo-agents-33e4e9db94",
  "docebo-knowledge-eed5dc239e",
  "f874aa9e-71e7-4f6e-ac27-f084c7b7d08b-1-c-44e88e5097",
  "july2026-what-s-new-3d39a8d938",
  "metaview-f75404f877",
  "platform-explainer-2026-v05c-w-music-32981d3544",
  "pub-eroxon-15s-hero-2ba3427fdb",
] as const;

const PREFIXES = RETIRED_MEDIA_IDS.map((id) => `media/${id}/`);

interface ObjectRef {
  key: string;
  bytes: number;
}

interface CliOptions {
  apply: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): CliOptions {
  let apply = false;
  let dryRun = false;

  for (const arg of argv) {
    switch (arg) {
      case "--apply":
        apply = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new UsageError(
          arg.startsWith("-")
            ? `unknown flag "${arg}"`
            : `unexpected argument "${arg}"`,
        );
    }
  }

  if (apply && dryRun) {
    throw new UsageError("--apply and --dry-run contradict each other");
  }

  return { apply };
}

function printHelp(): void {
  console.log(`pnpm media:delete-r2 - retire the seven replaced R2 prefixes

Usage
  pnpm media:delete-r2            Dry run: list the objects, delete nothing.
  pnpm media:delete-r2 --apply    Delete the objects.

The script only ever touches these prefixes:
${PREFIXES.map((prefix) => `  ${prefix}`).join("\n")}

Guards
  - every key must start with one of the prefixes above;
  - --apply refuses while any of the seven manifests is still in
    content/media/ (merge and deploy the replacement PR first);
  - after deleting, the script lists the prefixes again and fails if any
    object remains.

Credentials come from .env.r2; values are never printed.
`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(1)} ${unit}`;
}

function assertAllowed(key: string): void {
  if (!PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw new Error(`refusing key outside the 7 approved prefixes: ${key}`);
  }
}

async function listPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<ObjectRef[]> {
  const objects: ObjectRef[] = [];
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (item.Key === undefined) continue;
      assertAllowed(item.Key);
      objects.push({ key: item.Key, bytes: item.Size ?? 0 });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token !== undefined);

  return objects;
}

function assertManifestsGone(): void {
  const present = RETIRED_MEDIA_IDS.filter((id) =>
    existsSync(path.join(ROOT, "content", "media", `${id}.json`)),
  );
  if (present.length > 0) {
    throw new Error(
      `refusing --apply: ${present.length} retired manifest(s) still exist in content/media/ (${present.join(", ")}). Merge and deploy the replacement PR first.`,
    );
  }
}

async function deleteObjects(
  client: S3Client,
  bucket: string,
  objects: ObjectRef[],
): Promise<void> {
  for (let start = 0; start < objects.length; start += 1000) {
    const batch = objects.slice(start, start + 1000);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((object) => ({ Key: object.key })),
          Quiet: true,
        },
      }),
    );
    if ((result.Errors ?? []).length > 0) {
      const names = (result.Errors ?? [])
        .map((error) => `${error.Key ?? "?"}: ${error.Message ?? error.Code ?? "unknown error"}`)
        .join("; ");
      throw new Error(`delete failed for ${result.Errors?.length} object(s): ${names}`);
    }
    console.log(
      `  delete   ${batch.length} object(s) (${start + batch.length}/${objects.length})`,
    );
  }
}

function totalsOf(objects: ObjectRef[]): { count: number; bytes: number } {
  return objects.reduce(
    (totals, object) => ({
      count: totals.count + 1,
      bytes: totals.bytes + object.bytes,
    }),
    { count: 0, bytes: 0 },
  );
}

async function run(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const env = loadR2Env(ROOT);
  const client = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(env.accountId),
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  console.log(
    `R2 delete: ${PREFIXES.length} approved media prefixes in bucket ${env.bucket}`,
  );

  const objects: ObjectRef[] = [];
  for (const prefix of PREFIXES) {
    const listed = await listPrefix(client, env.bucket, prefix);
    const totals = totalsOf(listed);
    console.log(
      `  list     ${prefix} - ${totals.count} object(s), ${formatBytes(totals.bytes)}`,
    );
    objects.push(...listed);
  }

  const totals = totalsOf(objects);
  console.log(
    `  total    ${totals.count} object(s), ${formatBytes(totals.bytes)}`,
  );

  if (!options.apply) {
    console.log(
      "dry run: nothing deleted. Run `pnpm media:delete-r2 --apply` after the PR is merged and deployed.",
    );
    return 0;
  }

  assertManifestsGone();
  await deleteObjects(client, env.bucket, objects);

  let remaining = 0;
  for (const prefix of PREFIXES) {
    remaining += (await listPrefix(client, env.bucket, prefix)).length;
  }
  if (remaining > 0) {
    throw new Error(
      `${remaining} object(s) still remain under the retired prefixes`,
    );
  }

  console.log(
    `deleted ${totals.count} object(s); 0 remain under the ${PREFIXES.length} retired prefixes.`,
  );
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
      console.error(
        `delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
