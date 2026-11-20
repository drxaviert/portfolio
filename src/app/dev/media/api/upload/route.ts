import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { notFound } from "next/navigation";
import { enqueueUpload } from "../jobs";
import { safeUploadName, UploadNameError } from "../upload-name";
import type { HlsChoice, UploadOptions } from "../../job-types";

/** A raw body this large is a mistake, not a portfolio asset. */
const MAX_BYTES = 512 * 1024 * 1024;

const HLS_CHOICES: readonly HlsChoice[] = ["auto", "force", "off"];

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function readOptions(request: Request): UploadOptions {
  const caption = decodeURIComponent(
    request.headers.get("x-media-caption") ?? "",
  );
  const hls = request.headers.get("x-media-hls") ?? "auto";

  return {
    caption: caption.slice(0, 300),
    audio: request.headers.get("x-media-audio") === "1",
    hls: HLS_CHOICES.includes(hls as HlsChoice) ? (hls as HlsChoice) : "auto",
  };
}

/**
 * Streams one dropped file into `media/inbox/` and queues its encode. The body
 * is the file itself, not a multipart envelope, so a 150 MB video goes to disk
 * chunk by chunk instead of through a buffer.
 *
 * Dev only: production answers 404, like /dev/media itself.
 */
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") notFound();

  if (!request.body) return badRequest("The upload had no file in it.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return badRequest("That file is over 512 MB.", 413);
  }

  let upload: { name: string; kind: "image" | "video" };
  try {
    upload = safeUploadName(request.headers.get("x-media-name") ?? "");
  } catch (error) {
    if (error instanceof UploadNameError) return badRequest(error.message);
    throw error;
  }

  const options = readOptions(request);
  const inbox = path.join(process.cwd(), "media", "inbox");
  const target = path.join(inbox, upload.name);

  await mkdir(inbox, { recursive: true });

  try {
    await pipeline(
      Readable.fromWeb(
        request.body as unknown as NodeReadableStream<Uint8Array>,
      ),
      createWriteStream(target),
    );
  } catch (error) {
    // The partial file is ours; a half-written video must not look like a drop.
    await rm(target, { force: true }).catch(() => {});
    return badRequest(
      `The file could not be written to media/inbox/: ${
        error instanceof Error ? error.message : String(error)
      }.`,
      500,
    );
  }

  const job = enqueueUpload(upload.name, options);

  return Response.json({ job }, { status: 202 });
}
