import path from "node:path";

/**
 * The inbox filename for an upload. Everything downstream (`--only`, the
 * manifest id, the archive copy) keys off this basename, so it is reduced to
 * ASCII and a known extension before it ever touches the filesystem.
 */

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "tif",
  "tiff",
]);
export const VIDEO_EXTENSIONS = new Set(["mov", "mp4", "m4v", "webm", "mkv"]);

export class UploadNameError extends Error {}

export type SafeUpload = { name: string; kind: "image" | "video" };

export function safeUploadName(raw: string): SafeUpload {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    throw new UploadNameError("That filename could not be read.");
  }

  if (decoded === "") throw new UploadNameError("That file has no name.");
  if (/[\\/]/.test(decoded)) {
    throw new UploadNameError(
      "Drop files, not paths: the name must be a plain filename.",
    );
  }
  if (decoded.startsWith(".")) {
    throw new UploadNameError("Hidden files are not media.");
  }

  const ext = path.extname(decoded).slice(1).toLowerCase();
  const kind = IMAGE_EXTENSIONS.has(ext)
    ? "image"
    : VIDEO_EXTENSIONS.has(ext)
      ? "video"
      : null;

  if (!kind) {
    throw new UploadNameError(
      "Only images and videos can be uploaded here (png, jpg, webp, avif, tif, mov, mp4, webm, mkv).",
    );
  }

  const stem = decoded
    .slice(0, -(ext.length + 1))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80)
    .replace(/[-._]+$/, "");

  return { name: `${stem || "upload"}.${ext}`, kind };
}
