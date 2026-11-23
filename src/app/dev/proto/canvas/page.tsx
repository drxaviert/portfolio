import { notFound } from "next/navigation";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import type { LayoutName } from "@/components/canvas/layouts";
import { listMedia } from "@/lib/media";
import { CanvasProto } from "./canvas-proto";

/**
 * Throwaway prototype: an infinite, looping drag canvas of media tiles.
 *
 * Phase 1 of the drag-canvas exploration. Three layouts share one world model;
 * the owner picks one before anything is wired into `/work`. Dev-only, so a
 * production build 404s, exactly like the other `/dev/proto/*` routes.
 *
 * The media library only holds a handful of manifests today. The list cycles
 * until there are at least twelve tiles, because a world of three tiles cannot
 * show the seam or the momentum properly. Each copy gets its own key; the
 * manifest object itself is reused.
 */
export const metadata = {
  title: "Prototype · drag canvas",
  robots: { index: false, follow: false },
};

/** The deep link is read on the server, so this dev route may block. */
export const instant = false;

const LAYOUTS = ["grid", "masonry", "scatter"] as const;
const MIN_TILES = 12;

function pickLayout(value: string | string[] | undefined): LayoutName {
  return LAYOUTS.includes(value as LayoutName) ? (value as LayoutName) : "grid";
}

export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const query = await searchParams;
  const initialLayout = pickLayout(query.layout);
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

  return <CanvasProto initialLayout={initialLayout} items={items} />;
}
