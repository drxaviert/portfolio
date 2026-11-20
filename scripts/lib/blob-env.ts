/**
 * Blob auth for `pnpm post`.
 *
 * `vercel env pull` writes an OIDC JWT that expires after ~12 h, and `@vercel/blob`
 * rejects uploads once it does. Rather than making the user notice a mid-run failure
 * and re-pull by hand, `refreshBlobEnv` re-pulls `.env.blob` up front when the token
 * is missing, undecodable, or within `TOKEN_REFRESH_WINDOW_MS` of expiring.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ENV_FILE = ".env.blob";
const PULL_ARGS = [
  "env",
  "pull",
  ENV_FILE,
  "--environment=production",
  "--yes",
];
const MANUAL_PULL = `vercel ${PULL_ARGS.join(" ")}`;
export const TOKEN_REFRESH_WINDOW_MS = 15 * 60 * 1000;

/** `exp` in seconds, or null when the token is absent or not a decodable JWT. */
function tokenExpiry(token: string | undefined): number | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : null;
  } catch {
    return null;
  }
}

export function tokenNeedsRefresh(
  token: string | undefined,
  now: number,
): boolean {
  const exp = tokenExpiry(token);
  if (exp === null) return true;
  return exp * 1000 - now <= TOKEN_REFRESH_WINDOW_MS;
}

/**
 * Pulls `.env.blob` when it is missing or its token is stale, then loads the pulled
 * values into `process.env`. No-op when the current token is still good.
 */
export async function refreshBlobEnv(root: string): Promise<void> {
  const envPath = path.join(root, ENV_FILE);
  if (
    existsSync(envPath) &&
    !tokenNeedsRefresh(process.env.VERCEL_OIDC_TOKEN, Date.now())
  ) {
    return;
  }

  try {
    // `vercel` is a `.cmd` shim on Windows, so it has to go through a shell there.
    const command = `vercel ${PULL_ARGS.join(" ")}`;
    await execFileAsync(command, {
      cwd: root,
      shell: true,
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    const lines = stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const cause = lines.slice(0, 2).join(" ") || String(error);
    throw new Error(
      `could not refresh ${ENV_FILE} with the Vercel CLI (${cause}).\n` +
        `         Run it yourself:  ${MANUAL_PULL}`,
    );
  }

  // process.loadEnvFile never overwrites an already-set variable, so the freshly
  // pulled values have to be assigned directly to replace the expired ones.
  Object.assign(process.env, parseEnv(await readFile(envPath, "utf8")));
  console.log("blob: token expired or missing, refreshed via vercel env pull");
}
