import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { contentTypeFor } from "@/lib/media-content-types";

/**
 * Dev-only origin for `MEDIA_ORIGIN=local`.
 *
 * Local files mirror the R2 key layout under `media/local/`, so a manifest URL
 * `https://<r2-host>/media/<id>/video.mp4` is served at
 * `/media/local/media/<id>/video.mp4`. Production never enables this env and
 * the route 404s, keeping the R2 host as the only public origin.
 */
const MEDIA_ROOT = path.resolve(process.cwd(), "media", "local");

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  if (process.env.MEDIA_ORIGIN !== "local") return notFound();

  const { key } = await context.params;
  const file = path.resolve(MEDIA_ROOT, ...key);
  if (file !== MEDIA_ROOT && !file.startsWith(`${MEDIA_ROOT}${path.sep}`)) {
    return notFound();
  }

  let size: number;
  try {
    const stat = statSync(file);
    if (!stat.isFile()) return notFound();
    size = stat.size;
  } catch {
    return notFound();
  }

  const headers = {
    "Content-Type": contentTypeFor(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  const range = request.headers.get("range");
  if (!range) {
    return new Response(
      Readable.toWeb(createReadStream(file)) as ReadableStream,
      { headers: { ...headers, "Content-Length": String(size) } },
    );
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }

  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;

  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }

  end = Math.min(end, size - 1);
  return new Response(
    Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream,
    {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    },
  );
}
