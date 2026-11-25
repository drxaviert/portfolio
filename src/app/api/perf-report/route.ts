import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 2_000_000;

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

/**
 * Dev-only sink for the ?perf=1 HUD. The LAN dev origin is not a secure
 * context, so navigator.clipboard is unavailable there; this route accepts
 * the same JSON and writes it under the gitignored .perf-reports folder.
 *
 * Production builds answer 404 before touching the filesystem.
 */
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return notFound();

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return new Response("Report too large", { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const payload = body as {
    report?: unknown;
    kind?: unknown;
    temperature?: unknown;
  };
  if (!payload?.report || typeof payload.report !== "object") {
    return new Response("Missing report", { status: 400 });
  }

  const kind =
    payload.kind === "image" ? "image" : payload.kind === "video" ? "video" : null;
  if (!kind) return new Response("kind must be image or video", { status: 400 });

  const temperature = payload.temperature === "warm" ? "warm" : "cold";
  const dir = path.join(process.cwd(), ".perf-reports");
  await mkdir(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let file = `${stamp}-${kind}-${temperature}.json`;
  let counter = 1;
  while (existsSync(path.join(dir, file))) {
    file = `${stamp}-${kind}-${temperature}-${counter}.json`;
    counter += 1;
  }

  const receivedAt = new Date().toISOString();
  await writeFile(
    path.join(dir, file),
    JSON.stringify(
      {
        ...(payload.report as Record<string, unknown>),
        kind,
        temperature,
        receivedAt,
      },
      null,
      2,
    ),
    "utf8",
  );

  return Response.json({ file: `.perf-reports/${file}` });
}
