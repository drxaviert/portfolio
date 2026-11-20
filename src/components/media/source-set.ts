import type { MediaSource } from "@/lib/media-types";

/**
 * `w640.avif 640w, w1280.avif 1280w, …` for a `<source>` or `<img>` srcSet.
 *
 * The manifests already contain every width sharp made, so the browser does the
 * picking and no image ever goes through Vercel's optimiser — Hobby includes
 * 5K transformations a month and then answers 402.
 */
export function sourceSet(sources: MediaSource[]): string {
  return sources.map(({ url, width }) => `${url} ${width}w`).join(", ");
}
