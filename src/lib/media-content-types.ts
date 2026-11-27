/**
 * Content types for every file the media pipeline writes.
 *
 * The key's extension is the only input: `pnpm post` names outputs
 * `video.mp4`, `segment_0.m4s`, `master.m3u8` and so on, and the R2 upload and
 * the local dev route must answer with the same type. Keep this map in one
 * place so a new rendition cannot silently be served as a download.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  vtt: "text/vtt",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

/**
 * The type for a key such as `media/<id>/hls/master.m3u8`. Unknown extensions
 * fall back to `application/octet-stream` instead of guessing a media type.
 */
export function contentTypeFor(key: string): string {
  const withoutQuery = key.split(/[?#]/, 1)[0] ?? key;
  const extension = withoutQuery.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}
