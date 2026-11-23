/**
 * Shapes of the JSON manifests written by `pnpm post` to `content/media/<id>.json`.
 *
 * Every manifest is content-addressed: `id` is `<filename-slug>-<sha256 prefix>`, so a
 * re-run of the same file resolves to the same manifest and is skipped. Widths and
 * heights are the dimensions of the encoded media (post-rotation, post-downscale for
 * video), not the dimensions of the file in `media/archive/`.
 */

export type MediaKind = "image" | "video";
export type ImageFormat = "avif" | "webp";

/** One encoded image variant, e.g. 1280w WebP. */
export interface MediaSource {
  format: ImageFormat;
  width: number;
  url: string;
}

/** Poster stills for a video, both at the video's output size. */
export interface MediaPoster {
  avif: string;
  jpg: string;
}

export interface VideoFile {
  url: string;
  bytes: number;
}

/** One rung of an adaptive ladder, as the master playlist advertises it. */
export interface HlsLevel {
  height: number;
  bandwidth: number;
}

/** The adaptive ladder: a master playlist plus the bytes and rungs behind it. */
export interface VideoHls {
  url: string;
  bytes: number;
  levels: HlsLevel[];
}

interface MediaBase {
  id: string;
  kind: MediaKind;
  width: number;
  height: number;
  alt: string;
  caption: string;
  /** ISO 8601 timestamp of the ingest run. */
  createdAt: string;
  /** The archived original's filename, e.g. `clip.mov`. */
  original: string;
}

export interface ImageMedia extends MediaBase {
  kind: "image";
  /** Every variant, ascending by width. */
  sources: MediaSource[];
  /** Base64 WebP data URI of a 16px-wide placeholder. */
  lqip: string;
}

export interface VideoMedia extends MediaBase {
  kind: "video";
  mp4: VideoFile;
  webm?: VideoFile;
  /**
   * Small progressive rendition for the WebGL canvas (at most 480px tall, no
   * audio). Absent when the main MP4 is already that small.
   */
  canvas?: VideoFile;
  /** Present when the clip was long enough for an adaptive ladder. */
  hls?: VideoHls;
  poster: MediaPoster;
  /** Seconds. */
  duration: number;
  hasAudio: boolean;
}

export type MediaManifest = ImageMedia | VideoMedia;

export function isImageMedia(media: MediaManifest): media is ImageMedia {
  return media.kind === "image";
}

export function isVideoMedia(media: MediaManifest): media is VideoMedia {
  return media.kind === "video";
}
