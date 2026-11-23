import { notFound } from "next/navigation";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import { listMedia } from "@/lib/media";
import { CanvasProto } from "./canvas-proto";

/**
 * Throwaway prototype: an infinite, looping WebGL plane grid of media.
 *
 * Phase 2 of the drag-canvas exploration: the DOM tile renderer was replaced by
 * a three.js plane grid after the owner found the DOM version laggy. There is
 * one uniform grid now; the earlier masonry/scatter layouts were dropped rather
 * than kept as a second DOM renderer. Dev-only, so a production build 404s.
 *
 * The media library only holds a handful of manifests today. The list cycles
 * until there are at least twelve items; the renderer cycles them again across
 * every cell of the grid.
 */
export const metadata = {
  title: "Prototype · drag canvas",
  robots: { index: false, follow: false },
};

const MIN_TILES = 12;

export default async function CanvasPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const media = listMedia();
  const items: CanvasItem[] = [];

  if (media.length > 0) {
    const count = Math.max(MIN_TILES, media.length);

    for (let index = 0; index < count; index += 1) {
      const manifest = media[index % media.length];

      items.push({
        key: `${manifest.id}--${index}`,
        media: manifest,
      });
    }
  }

  return <CanvasProto items={items} />;
}
