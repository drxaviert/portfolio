/**
 * R2 credentials for the media pipeline.
 *
 * The owner keeps them in `.env.r2` at the repo root (gitignored). This module
 * only ever names keys, never their values: an error from here is safe to paste
 * into a terminal or a report.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export const R2_ENV_FILE = ".env.r2";

export const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

export type R2EnvKey = (typeof R2_ENV_KEYS)[number];

export interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** No trailing slash. */
  publicBaseUrl: string;
}

/**
 * Reads `.env.r2` without touching `process.env` and without validating. A
 * missing file is an empty record, which lets `next.config.ts` ask for the
 * public host on machines that have not run the migration yet.
 */
export function readR2EnvFile(
  root: string,
): Record<string, string | undefined> {
  const file = path.join(root, R2_ENV_FILE);
  if (!existsSync(file)) return {};

  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read ${R2_ENV_FILE}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** The public base URL from the environment or `.env.r2`, if either has one. */
export function readR2PublicBaseUrl(root: string): string | null {
  const fromEnv = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv;

  return readR2EnvFile(root).R2_PUBLIC_BASE_URL?.trim() || null;
}

export interface LoadR2EnvOptions {
  /**
   * `false` requires only `R2_PUBLIC_BASE_URL`; `pnpm post --local` needs no
   * upload credentials because it writes files under `media/local/`.
   */
  requireCredentials?: boolean;
}

/**
 * Loads and validates the R2 keys. `process.env` wins over `.env.r2` so a
 * shell override (or CI secret) works without editing the file.
 *
 * Throws once with every missing key named. Values never appear in the message.
 */
export function loadR2Env(
  root: string,
  { requireCredentials = true }: LoadR2EnvOptions = {},
): R2Env {
  const fileValues = readR2EnvFile(root);
  const values = Object.fromEntries(
    R2_ENV_KEYS.map((key) => [
      key,
      process.env[key]?.trim() || fileValues[key]?.trim() || "",
    ]),
  ) as Record<R2EnvKey, string>;

  const required = requireCredentials
    ? R2_ENV_KEYS
    : (["R2_PUBLIC_BASE_URL"] as const);
  const missing = required.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing R2 configuration in ${R2_ENV_FILE}: ${missing.join(", ")}. ` +
        `Fill ${missing.length === 1 ? "that key" : "those keys"}; values are never printed.`,
    );
  }

  let publicUrl: URL;
  try {
    publicUrl = new URL(values.R2_PUBLIC_BASE_URL);
  } catch {
    throw new Error(
      `R2_PUBLIC_BASE_URL in ${R2_ENV_FILE} must be an absolute https URL (for example https://media.example.com).`,
    );
  }
  if (publicUrl.protocol !== "https:") {
    throw new Error(`R2_PUBLIC_BASE_URL in ${R2_ENV_FILE} must use https.`);
  }

  return {
    accountId: values.R2_ACCOUNT_ID,
    accessKeyId: values.R2_ACCESS_KEY_ID,
    secretAccessKey: values.R2_SECRET_ACCESS_KEY,
    bucket: values.R2_BUCKET,
    publicBaseUrl: values.R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  };
}
