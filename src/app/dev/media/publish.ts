import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Publishing media to main, dev-only.
 *
 * The rule is deliberately narrow: a media publish may only commit manifests,
 * so it refuses unless the checkout is on `main` and every dirty path is under
 * `content/media/`. Anything else is Dat's work in progress and must not ride
 * along. The git calls never use `git add -A` or `git add .`: the exact
 * manifest paths are added.
 */

const MEDIA_PREFIX = "content/media/";
const PULL_TIMEOUT_MS = 120_000;
const PUSH_TIMEOUT_MS = 300_000;

export type PublishState = {
  branch: string;
  /** Repo-relative manifest paths with unstaged, staged or untracked changes. */
  unpublished: string[];
  /** Why the button is off, in words Dat can act on. */
  blocker: string | null;
};

export type PublishResult =
  { ok: true; sha: string; ids: string[] } | { ok: false; error: string };

type GitRun = { code: number; stdout: string; stderr: string };

export function parseStatus(output: string): {
  media: string[];
  other: string[];
} {
  const media: string[] = [];
  const other: string[] = [];

  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") continue;

    // `XY path`, and `R  old -> new` for a rename.
    let file = line.slice(3).trim();
    const arrow = file.indexOf(" -> ");
    if (arrow !== -1) file = file.slice(arrow + 4);
    file = file.replace(/^"(.*)"$/, "$1");

    if (file.startsWith(MEDIA_PREFIX) && file.endsWith(".json")) {
      media.push(file);
    } else {
      other.push(file);
    }
  }

  return { media, other };
}

function git(
  cwd: string,
  args: string[],
  options: { input?: string; timeoutMs?: number } = {},
): Promise<GitRun> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => child.kill(), options.timeoutMs);
    }

    if (options.input !== undefined) child.stdin.write(options.input);
    child.stdin.end();
  });
}

function failure(run: GitRun): string {
  return (
    run.stderr.trim() || run.stdout.trim() || `git exited with ${run.code}.`
  );
}

export async function readPublishState(
  cwd: string = process.cwd(),
): Promise<PublishState> {
  const [branchRun, statusRun] = await Promise.all([
    git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]),
  ]);

  if (branchRun.code !== 0) {
    return {
      branch: "",
      unpublished: [],
      blocker: `This checkout is not a git repository: ${failure(branchRun)}`,
    };
  }

  const branch = branchRun.stdout.trim();
  const { media, other } = parseStatus(statusRun.stdout);

  let blocker: string | null = null;
  if (branch !== "main") {
    blocker = "Switch this checkout to main to publish.";
  } else if (other.length > 0) {
    const list = other.slice(0, 3).join(", ");
    blocker = `Other changes are in the way: ${list}${
      other.length > 3 ? ` and ${other.length - 3} more` : ""
    }.`;
  } else if (media.length === 0) {
    blocker = "Nothing new to publish.";
  }

  return { branch, unpublished: media, blocker };
}

type ManifestLine = { id: string; kind: string; caption: string };

async function readManifests(
  cwd: string,
  files: string[],
): Promise<ManifestLine[]> {
  const lines: ManifestLine[] = [];

  for (const file of files) {
    const id = path.basename(file, ".json");
    const raw = JSON.parse(
      await readFile(path.join(cwd, file), "utf8"),
    ) as Record<string, unknown>;

    if (raw.id !== id) {
      throw new Error(`${file} is invalid: its id is not "${id}".`);
    }
    if (raw.kind !== "image" && raw.kind !== "video") {
      throw new Error(`${file} is invalid: its kind is not image or video.`);
    }

    lines.push({
      id,
      kind: raw.kind,
      caption: typeof raw.caption === "string" ? raw.caption : "",
    });
  }

  return lines;
}

function commitMessage(lines: ManifestLine[]): string {
  const subject = `content(media): publish ${lines
    .map((line) => line.id)
    .join(", ")}`;
  const body = lines
    .map(
      (line) =>
        `- ${line.id} (${line.kind})${line.caption ? ` "${line.caption}"` : ""}`,
    )
    .join("\n");

  return `${subject}\n\n${body}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n`;
}

/**
 * Publish the pending manifests: pull, commit only those files, push. Called by
 * the dev-only route; also callable with another `cwd` so the whole flow can be
 * rehearsed against a throwaway clone.
 */
export async function publishMedia(
  cwd: string = process.cwd(),
): Promise<PublishResult> {
  const state = await readPublishState(cwd);
  if (state.blocker) return { ok: false, error: state.blocker };

  let manifests: ManifestLine[];
  try {
    manifests = await readManifests(cwd, state.unpublished);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const pull = await git(cwd, ["pull", "--rebase", "origin", "main"], {
    timeoutMs: PULL_TIMEOUT_MS,
  });
  if (pull.code !== 0) {
    // A conflicted rebase would leave the checkout mid-rebase; put it back.
    await git(cwd, ["rebase", "--abort"]);
    return { ok: false, error: `git pull --rebase failed. ${failure(pull)}` };
  }

  // Re-check: the pull may have brought new commits that touch media.
  const afterPull = await readPublishState(cwd);
  if (afterPull.blocker) return { ok: false, error: afterPull.blocker };

  try {
    manifests = await readManifests(cwd, afterPull.unpublished);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const add = await git(cwd, ["add", "--", ...afterPull.unpublished]);
  if (add.code !== 0) {
    return { ok: false, error: `git add failed. ${failure(add)}` };
  }

  const commit = await git(cwd, ["commit", "-F", "-"], {
    input: commitMessage(manifests),
  });
  if (commit.code !== 0) {
    return { ok: false, error: `git commit failed. ${failure(commit)}` };
  }

  const push = await git(cwd, ["push", "origin", "main"], {
    timeoutMs: PUSH_TIMEOUT_MS,
  });
  if (push.code !== 0) {
    return {
      ok: false,
      error: `The commit exists locally but the push failed. ${failure(push)}`,
    };
  }

  const sha = await git(cwd, ["rev-parse", "--short", "HEAD"]);

  return {
    ok: true,
    sha: sha.stdout.trim(),
    ids: manifests.map((manifest) => manifest.id),
  };
}
