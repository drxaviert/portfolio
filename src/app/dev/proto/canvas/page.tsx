import { notFound } from "next/navigation";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import { getMedia } from "@/lib/media";
import { CanvasProto } from "./canvas-proto";
import { CANVAS_MEDIA_IDS } from "./items";

/**
 * Throwaway prototype: an infinite, looping WebGL plane grid of real media.
 *
 * The ids are listed explicitly in `items.ts`, interleaved by project. The
 * three placeholder manifests used by the first prototype stay on disk for
 * other pages but are not in this list. Dev-only, so a production build 404s.
 */
export const metadata = {
  title: "Prototype · drag canvas",
  robots: { index: false, follow: false },
};

export default function CanvasPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const items: CanvasItem[] = CANVAS_MEDIA_IDS.map((id, index) => ({
    key: `${id}--${index}`,
    media: getMedia(id),
  }));

  return <CanvasProto items={items} />;
}
