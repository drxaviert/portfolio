import type { ReactNode } from "react";
import { Media } from "@/components/media/media";
import type { WorkMeta } from "@/lib/work";
import { Cover } from "./cover";
import { StepFigurePanel } from "./step-figure";

/**
 * The Margin layout's media slots. These stay server components so an id can be
 * resolved to its manifest before render; the stateful figures live in
 * `parts.tsx` and `step-figure.tsx`.
 *
 * Each slot accepts a `media` id, a `<Media>` child, or neither. With neither
 * it draws the neutral `div.wd-media` box the site shipped with, which is why
 * every existing page renders exactly as it did.
 */

/**
 * The cover scene at the top of the study, carrying the featured card's
 * picture across the expand morph. Without a scene or a media id it stays the
 * neutral media box, which is what the MDX `<Hero />` maps to.
 */
export function Hero({
  scene,
  coverImage,
  media,
  children,
}: {
  scene?: WorkMeta["cover"];
  coverImage?: WorkMeta["coverImage"];
  media?: string;
  children?: ReactNode;
}) {
  const slot =
    children ??
    (media ? (
      <Media
        id={media}
        className="wd-hero-media"
        priority
        sizes="(min-width: 768px) 582px, 100vw"
      />
    ) : null);

  return (
    <div
      className={["wd-hero", !scene && !slot && "wd-hero-neutral"]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {slot ?? (scene ? <Cover scene={scene} coverImage={coverImage} /> : null)}
    </div>
  );
}

export function Figure({
  caption,
  aspect = "16 / 9",
  marginCaption = false,
  wide = false,
  className = "",
  media,
  children,
}: {
  caption?: string;
  aspect?: string;
  marginCaption?: boolean;
  wide?: boolean;
  className?: string;
  /** A media id from `content/media/`; ignored when `children` is given. */
  media?: string;
  children?: ReactNode;
}) {
  const classes = ["wd-fig", wide && "wd-fig-wide", className]
    .filter(Boolean)
    .join(" ");

  const slot =
    children ??
    (media ? (
      <Media
        id={media}
        className="wd-media"
        sizes={
          wide
            ? "(min-width: 768px) 880px, 100vw"
            : "(min-width: 768px) 560px, 100vw"
        }
      />
    ) : null);

  return (
    <figure className={classes}>
      {slot ?? <div className="wd-media" style={{ aspectRatio: aspect }} />}
      {caption ? (
        <figcaption
          className={["wd-caption", marginCaption && "wd-caption-margin"]
            .filter(Boolean)
            .join(" ")}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function StepFigure({
  steps,
  media,
  children,
}: {
  steps: string[];
  media?: string;
  children?: ReactNode;
}) {
  const slot =
    children ??
    (media ? <Media id={media} className="wd-step-media" /> : undefined);

  return <StepFigurePanel steps={steps} media={slot} />;
}

export function ContactSheet({
  caption,
  media,
  children,
}: {
  caption: string;
  media?: string;
  children?: ReactNode;
}) {
  const slot =
    children ??
    (media ? <Media id={media} className="wd-contact-media" /> : null);

  return (
    <figure className="wd-contact">
      {slot ? (
        <div className="wd-contact-single">{slot}</div>
      ) : (
        <div className="wd-contact-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="wd-media" />
          ))}
        </div>
      )}
      <figcaption className="wd-caption">{caption}</figcaption>
    </figure>
  );
}
