"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { FallbackPainting } from "./fallback-painting";
import { ImageUnavailable } from "./image-unavailable";

/** The one src the card and dialog share for an AIC image. */
export function artImageSrc(imageId: string, variant: "card" | "full"): string {
  const width = variant === "full" ? 1686 : 843;

  return `/api/art/image/${encodeURIComponent(imageId)}?width=${width}`;
}

/**
 * The IIIF image at the frame's width, with AIC's inline LQIP underneath.
 *
 * The src is our own proxy (`/api/art/image/...`), not the IIIF host: AIC's
 * image CDN requires an `AIC-User-Agent` header that a browser <img> cannot
 * send, and its same-origin CORP header blocks a direct embed anyway. The
 * proxy fetches with the header once and the browser caches the bytes.
 *
 * Failure is keyed to the src and owned by this instance:
 * - a new src is a new state, so an old failure cannot leak onto the new art;
 * - a successful load clears a previous failure;
 * - errors from an unmounted image or a superseded src are ignored. Closing
 *   the dialog or switching days aborts a load, and an abort is not a 502.
 *
 * `onUnavailable`/`onAvailable` carry the same src key upward so the scene or
 * dialog can show one written note without owning the image's lifecycle.
 */
export function ArtImage({
  art,
  variant = "card",
  onUnavailable,
  onAvailable,
}: {
  art: DailyArt;
  variant?: "card" | "full";
  onUnavailable?: (src: string) => void;
  onAvailable?: (src: string) => void;
}) {
  const src = art.imageId ? artImageSrc(art.imageId, variant) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCurrent = (
    image: HTMLImageElement | null,
  ): image is HTMLImageElement =>
    Boolean(src) && mountedRef.current && image?.getAttribute("src") === src;

  // A cached image can finish before React attaches onLoad. This ref only
  // updates this instance's paint state; the scene/dialog owns the written
  // failure note, so a remount starts clean.
  const attachImage = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image || !src || !mountedRef.current) return;
      if (image.getAttribute("src") !== src) return;
      if (image.complete && image.naturalWidth > 0) {
        setLoadedSrc(src);
        onAvailable?.(src);
      }
    },
    [src, onAvailable],
  );

  if (!src) return <FallbackPainting />;
  if (failedSrc === src) return <ImageUnavailable />;

  return (
    <span
      className="art-image"
      data-loaded={loadedSrc === src ? "true" : undefined}
    >
      {art.lqip ? (
        <span
          className="art-image-lqip"
          style={{ backgroundImage: `url("${art.lqip}")` }}
          aria-hidden="true"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        ref={attachImage}
        src={src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        loading="eager"
        fetchPriority={variant === "card" ? "high" : "auto"}
        decoding="async"
        draggable={false}
        onLoad={(event) => {
          if (!isCurrent(event.currentTarget)) return;

          setLoadedSrc(src);
          setFailedSrc((current) => (current === src ? null : current));
          onAvailable?.(src);
        }}
        onError={(event) => {
          if (!isCurrent(event.currentTarget)) return;

          setFailedSrc(src);
          onUnavailable?.(src);

          if (process.env.NODE_ENV === "development") {
            console.warn(`[art-image] painting image failed: ${src}`);
          }
        }}
      />
    </span>
  );
}
