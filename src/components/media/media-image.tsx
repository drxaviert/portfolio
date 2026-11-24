import type { CSSProperties } from "react";
import type { ImageMedia } from "@/lib/media-types";
import { sourceSet } from "./source-set";

/**
 * An image from a manifest, as a `<picture>` rather than `next/image`.
 *
 * A `next/image` custom loader returns one URL per width, so it cannot offer
 * AVIF with a WebP fallback. `<picture>` can (`<source type="image/avif">` then
 * a WebP srcset on the img), and it is the same zero-cost path: every width it
 * points at was encoded ahead of time. The LQIP is the wrapper's background, so
 * the blur is there before the file arrives and no script is needed to fade it.
 */
export function MediaImage({
  media,
  alt,
  className = "",
  priority = false,
  fullRes = false,
  sizes = "(min-width: 768px) 560px, 100vw",
}: {
  media: ImageMedia;
  alt: string;
  className?: string;
  priority?: boolean;
  /** The opened canvas view uses the largest variant, matching its preload. */
  fullRes?: boolean;
  sizes?: string;
}) {
  const largest = (sources: typeof media.sources) =>
    [...sources].sort((a, b) => b.width - a.width).slice(0, 1);

  const avifAll = media.sources.filter((source) => source.format === "avif");
  const webpAll = media.sources.filter((source) => source.format === "webp");
  const avif = fullRes ? largest(avifAll) : avifAll;
  const webp = fullRes ? largest(webpAll) : webpAll;
  // The `src` is only read by browsers without srcSet support; give them the
  // smallest file rather than the full-size original.
  const fallback = webp[0] ?? avif[0];

  if (!fallback) {
    throw new Error(
      `content/media/${media.id}.json has no image sources to draw`,
    );
  }

  return (
    <div
      className={["media", className].filter(Boolean).join(" ")}
      data-media-kind="image"
      style={
        {
          "--media-aspect": `${media.width} / ${media.height}`,
          ...(media.lqip ? { backgroundImage: `url("${media.lqip}")` } : {}),
        } as CSSProperties
      }
    >
      <picture>
        {avif.length > 0 ? (
          <source type="image/avif" srcSet={sourceSet(avif)} sizes={sizes} />
        ) : null}
        {webp.length > 0 ? (
          <source type="image/webp" srcSet={sourceSet(webp)} sizes={sizes} />
        ) : null}
        <img
          className="media-asset"
          src={fallback.url}
          srcSet={sourceSet(webp.length > 0 ? webp : avif)}
          sizes={sizes}
          width={media.width}
          height={media.height}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
      </picture>
    </div>
  );
}
