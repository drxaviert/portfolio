import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { JobStage, JobView, UploadOptions } from "../job-types";

/**
 * The dev library's encoder queue.
 *
 * One `scripts/post.ts` run at a time: ffmpeg saturates the CPU, and two HLS
 * ladders at once would make both look stuck. Jobs live on `globalThis` so the
 * upload route, the polling route and HMR all see the same queue.
 *
 * Everything here is dev-only; the routes that reach it 404 in production.
 */

const ROOT = process.cwd();
const POST_SCRIPT = path.join(ROOT, "scripts", "post.ts");

/** The last N stderr lines are enough to say why an upload failed. */
const ERROR_TAIL_LINES = 24;
const MAX_JOBS = 50;

type JobRecord = JobView & {
  createdAt: number;
  finishedAt?: number;
  options: UploadOptions;
};

type Store = {
  jobs: Map<string, JobRecord>;
  queue: string[];
  running: boolean;
};

const STORE_KEY = "__devMediaLibraryJobs";

function store(): Store {
  const holder = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  holder[STORE_KEY] ??= { jobs: new Map(), queue: [], running: false };
  return holder[STORE_KEY];
}

function trim(record: JobRecord): JobView {
  return {
    id: record.id,
    name: record.name,
    stage: record.stage,
    ...(record.error ? { error: record.error } : {}),
  };
}

export function listJobs(): JobView[] {
  return [...store().jobs.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(trim);
}

export function getJob(id: string): JobView | undefined {
  const record = store().jobs.get(id);
  return record ? trim(record) : undefined;
}

/** A finished card can be dismissed; a queued or running job cannot. */
export function dismissJob(id: string): boolean {
  const current = store();
  const record = current.jobs.get(id);
  if (!record) return false;
  if (record.stage !== "done" && record.stage !== "failed") return false;

  current.jobs.delete(id);
  return true;
}

export function enqueueUpload(name: string, options: UploadOptions): JobView {
  const current = store();
  const record: JobRecord = {
    id: randomUUID(),
    name,
    stage: "queued",
    createdAt: Date.now(),
    options,
  };

  current.jobs.set(record.id, record);
  current.queue.push(record.id);
  collectGarbage();
  void pump();

  return trim(record);
}

function collectGarbage(): void {
  const current = store();
  if (current.jobs.size <= MAX_JOBS) return;

  const finished = [...current.jobs.values()]
    .filter((job) => job.stage === "done" || job.stage === "failed")
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const job of finished) {
    if (current.jobs.size <= MAX_JOBS) break;
    current.jobs.delete(job.id);
  }
}

async function pump(): Promise<void> {
  const current = store();
  if (current.running) return;
  current.running = true;

  try {
    while (current.queue.length > 0) {
      const id = current.queue.shift();
      if (id === undefined) break;

      const record = current.jobs.get(id);
      // Dismissed while queued, or evicted: nothing to run.
      if (!record) continue;

      await runJob(record);
    }
  } finally {
    current.running = false;
  }
}

function argsFor(name: string, options: UploadOptions): string[] {
  const args = [POST_SCRIPT, "--only", name];

  if (options.caption.trim() !== "") args.push("--caption", options.caption);
  if (options.audio) args.push("--audio");
  if (options.hls === "force") args.push("--hls");
  if (options.hls === "off") args.push("--no-hls");

  return args;
}

/**
 * post.ts prints `upload` just before every R2 request, so the first one
 * marks the move from local encoding to uploading. Everything before it is
 * encoding, which is the long part.
 */
function stageFromLine(line: string, stage: JobStage): JobStage {
  if (stage !== "encoding") return stage;
  return /^\s*upload\s/.test(line) ? "uploading" : stage;
}

/** Friendly first line, then the encoder's own words. */
function plainFailure(stderr: string, exitCode: number | null): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tail = lines.slice(-ERROR_TAIL_LINES).join("\n");

  if (
    /Missing R2 configuration|AccessDenied|blob upload was rejected|token.*expired|401|403/i.test(
      tail,
    )
  ) {
    return `R2 rejected the upload. Check the keys in .env.r2, then drop the file again.\n${tail}`;
  }
  if (/ffmpeg|ffprobe|spawn .*ENOENT|not recognized/i.test(tail)) {
    return `ffmpeg or ffprobe is not on PATH, so nothing could be encoded.\n${tail}`;
  }
  if (/over the 10 MB cap|MB budget/i.test(tail)) {
    return `The encode was over the size budget.\n${tail}`;
  }

  return tail || `The encoder exited with code ${String(exitCode)}.`;
}

async function runJob(record: JobRecord): Promise<void> {
  record.stage = "encoding";

  await new Promise<void>((resolve) => {
    const child = spawn(
      process.execPath,
      argsFor(record.name, record.options),
      {
        cwd: ROOT,
        env: process.env,
        windowsHide: true,
      },
    );

    let stderr = "";
    let stdoutBuffer = "";

    const readStdout = (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        record.stage = stageFromLine(line, record.stage);
      }
    };

    child.stdout.on("data", readStdout);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      // Keep the tail bounded even on a long ffmpeg rant.
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });

    child.on("error", (error) => {
      record.stage = "failed";
      record.error = `Could not start the encoder: ${error.message}`;
      record.finishedAt = Date.now();
      resolve();
    });

    child.on("close", (code) => {
      record.finishedAt = Date.now();

      if (code === 0) {
        record.stage = "done";
      } else {
        record.stage = "failed";
        record.error = plainFailure(stderr, code);
      }
      resolve();
    });
  });
}
