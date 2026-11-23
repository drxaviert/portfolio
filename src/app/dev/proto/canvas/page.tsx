import { notFound } from "next/navigation";
import type {
  CanvasItem,
  LensSettings,
} from "@/components/canvas/infinite-canvas";
import { LENS, clamp } from "@/components/canvas/lens";
import { getMedia } from "@/lib/media";
import { CanvasProto } from "./canvas-proto";
import { CANVAS_MEDIA_IDS } from "./items";

/**
 * Throwaway prototype: an infinite, looping WebGL plane grid of real media.
 *
 * The ids are listed explicitly in `items.ts`, interleaved by project. The
 * three placeholder manifests used by the first prototype stay on disk for
 * other pages but are not in this list. Dev-only, so a production build 404s.
 *
 * `?lens=flat` compares the flat view; the orb is the default. The strength,
 * drag-boost and vignette values are read here too, so a tuned look survives a
 * reload or a share.
 */
export const metadata = {
  title: "Prototype · drag canvas",
  robots: { index: false, follow: false },
};

/** The deep link is read on the server, so this dev route may block. */
export const instant = false;

function amount(
  value: string | string[] | undefined,
  fallback: number,
  max: number,
): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? clamp(parsed, 0, max) : fallback;
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
  const lens: LensSettings = {
    mode: query.lens === "flat" ? "flat" : "globe",
    strength: amount(query.strength, LENS.defaultStrength, LENS.maxStrength),
    boost: amount(query.boost, LENS.defaultBoost, LENS.maxBoost),
    vignette: amount(query.vignette, LENS.defaultVignette, LENS.maxVignette),
  };
  const items: CanvasItem[] = CANVAS_MEDIA_IDS.map((id, index) => ({
    key: `${id}--${index}`,
    media: getMedia(id),
  }));

  return <CanvasProto items={items} initialLens={lens} />;
}
