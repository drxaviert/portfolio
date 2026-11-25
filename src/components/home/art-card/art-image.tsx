"use client";

import { useCallback, useState } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { FallbackPainting } from "./fallback-painting";
import { ImageUnavailable } from "./image-unavailable";

/**
 * The IIIF image at the frame's width, with AIC's inline LQIP underneath.
 *
 * The src is our own proxy (`/api/art/image/...`), not the IIIF host: AIC's
 * image CDN requires an `AIC-User-Agent` header that a browser <img> cannot
 * send, and its same-origin CORP header blocks a direct embed anyway. The
 * proxy fetches with the header once and the browser caches the bytes.
 *
 * The frame reserves the exact aspect before either image arrives, so the blur
 * placeholder is only a paint concern, never a layout one. The image is always
 * opaque once the browser has it; the placeholder fades out underneath, which
 * also keeps the card visible if hydration never happens.
 *
 * A failed image is an explicit state, not a silent swap: `onUnavailable`
 * lets the card or dialog say what happened, and dev logs the failing source.
 */
export function ArtImage({
  art,
  variant = "card",
  onUnavailable,
}: {
  art: DailyArt;
  variant?: "card" | "full";
  onUnavailable?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // A cached image can finish before React attaches onLoad; the ref callback
  // sees complete=true at commit and hides the blurred placeholder at once.
  const attachImage = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, []);

  if (!art.imageId) return <FallbackPainting />;
  if (failed) return <ImageUnavailable />;

  const width = variant === "full" ? 1686 : 843;
  const src = `/api/art/image/${encodeURIComponent(art.imageId)}?width=${width}`;

  return (
    <span className="art-image" data-loaded={loaded ? "true" : undefined}>
      {art.lqip ? (
        <span
          className="art-image-lqip"
          style={{ backgroundImage: `url("${art.lqip}")` }}
          aria-hidden="true"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={attachImage}
        src={src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        loading="eager"
        fetchPriority={variant === "card" ? "high" : "auto"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          onUnavailable?.();

          if (process.env.NODE_ENV === "development") {
            console.warn(`[art-image] painting image failed: ${src}`);
          }
        }}
      />
    </span>
  );
}
