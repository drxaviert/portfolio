import { notFound } from "next/navigation";
import { listMedia } from "@/lib/media";
import type { MediaManifest } from "@/lib/media";
import type { ImageMedia } from "@/lib/media-types";
import { MediaLibrary } from "./media-library";
import type { LibraryItem } from "./media-library";

/**
 * Dev-only browser for the file-based media pipeline: every manifest in
 * `content/media`, with its id and the `<Media>` tag to copy. Deep links into
 * this route 404 in a production build.
 */
export const metadata = {
  title: "Media library",
  robots: { index: false, follow: false },
};

// The list, the queue and the publish count all change under the page, so it
// renders per request. Same switch as the other dev prototypes.
export const instant = false;

/** The encoded variant at one end of the ladder; WebP wins a width tie. */
function variant(media: ImageMedia, edge: "smallest" | "largest"): string {
  const widths = media.sources.map((source) => source.width);
  const width = edge === "smallest" ? Math.min(...widths) : Math.max(...widths);
  const atWidth = media.sources.filter((source) => source.width === width);

  return (atWidth.find((source) => source.format === "webp") ?? atWidth[0]).url;
}

/**
 * What the manifest actually records. Images carry widths and URLs but no
 * bytes, so their card says "not recorded" rather than guessing.
 */
function recordedBytes(media: MediaManifest): number | null {
  if (media.kind === "image") return null;

  return media.mp4.bytes + (media.webm?.bytes ?? 0) + (media.hls?.bytes ?? 0);
}

function toItem(media: MediaManifest): LibraryItem {
  if (media.kind === "video") {
    return {
      id: media.id,
      kind: "video",
      hls: Boolean(media.hls),
      width: media.width,
      height: media.height,
      duration: media.duration,
      bytes: recordedBytes(media),
      createdAt: media.createdAt,
      caption: media.caption,
      alt: media.alt,
      // Never a <video>: this page shows stills and nothing plays on its own.
      thumbnail: media.poster.jpg,
      fullSize: media.mp4.url,
    };
  }

  return {
    id: media.id,
    kind: "image",
    hls: false,
    width: media.width,
    height: media.height,
    duration: null,
    bytes: recordedBytes(media),
    createdAt: media.createdAt,
    caption: media.caption,
    alt: media.alt,
    thumbnail: variant(media, "smallest"),
    fullSize: variant(media, "largest"),
  };
}

export default async function DevMediaPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MediaLibrary items={listMedia().map(toItem)} />;
}
