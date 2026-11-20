import { getMedia } from "@/lib/media";
import { MediaImage } from "./media-image";
import { MediaVideo } from "./media-video";
import "./media.css";

/**
 * One manifest, drawn by kind. Server-side: `getMedia` reads and validates the
 * committed JSON, so a bad id fails the build instead of shipping a broken
 * frame. The video hands its manifest to a client child; the image is static.
 */
export function Media({
  id,
  alt,
  className = "",
  priority = false,
  sizes,
}: {
  id: string;
  /** Overrides the manifest's alt text. An empty string marks it decorative. */
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const media = getMedia(id);
  const label = alt ?? media.alt;

  if (media.kind === "image") {
    return (
      <MediaImage
        media={media}
        alt={label}
        className={className}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  return <MediaVideo media={media} alt={label} className={className} />;
}
