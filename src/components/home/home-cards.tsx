import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { Cover } from "@/components/work/cover";
import type { CoverImage } from "@/lib/media";
import type { WorkMeta } from "@/lib/work";
import { EMPTY_WORK_LABEL } from "./empty-work";
import { EntranceCell } from "./entrance-cell";
import type { EntranceVariant } from "./entrance-cell";
import { RingLayers } from "./ring-hover";
import "./home-cards.css";

/**
 * The home page's cards, shared by / and /dev/prototype.
 *
 * The main band is 753 / 180 / 83 / 84 at 1440, 656 / 140 / 64 / 64 at 1024,
 * 444 / 120 / 52 / 52 at 768, with 12px gutters. Work slivers have no content
 * in Figma, so they are decorative stand-ins; the highlight card carries the
 * placeholder project title.
 */

export const WORK_SLIVERS = [
  { fill: "bg-surface-container", height: "h-18" },
  {
    fill: "bg-surface dark:bg-surface-container-high",
    height: "h-14",
  },
  {
    fill: "bg-surface dark:bg-surface-container-highest",
    height: "h-14",
  },
];

/**
 * Optional interactive mode: when `onOpen` is absent the card is exactly the
 * shipped, non-interactive article.
 */
function cardInteraction(onOpen: (element: HTMLElement) => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": "Open case study",
    style: { cursor: "pointer" },
    onClick: (event: MouseEvent<HTMLElement>) => onOpen(event.currentTarget),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpen(event.currentTarget);
    },
  };
}

type ProjectCardProps = {
  title?: string;
  /** With a slug the card links to the study and becomes the morph's source. */
  slug?: string;
  /** The featured study's cover, drawn edge-to-edge behind the title. */
  scene?: WorkMeta["cover"];
  /** Set when the cover is a media id: the picture the server resolved. */
  coverImage?: CoverImage;
  onOpen?: (element: HTMLElement) => void;
};

/** The featured card; `.ring-card` grows its hover ring with transform scale. */
const CARD_CLASS =
  "ring-host ring-card flex h-[420px] flex-col justify-end rounded-lg p-5 md:h-auto md:p-8";

/** Highlight card: the only card with a title. */
export function ProjectCard({
  title = EMPTY_WORK_LABEL,
  slug,
  scene,
  coverImage,
  onOpen,
}: ProjectCardProps = {}) {
  const content = (
    <>
      <RingLayers fill="bg-surface-container-low" />
      {scene ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 z-0 overflow-hidden"
          >
            <Cover scene={scene} coverImage={coverImage} fit="cover" />
          </div>
          {/* The shot's own colour comes back under the title, so the bars
              recede instead of running through the text. */}
          <span
            aria-hidden="true"
            className="card-fade pointer-events-none absolute inset-8 z-[1] rounded-md"
          />
        </>
      ) : null}
      <h1
        dir="auto"
        className="card-title ring-title relative z-10 text-balance text-title-sm font-semibold md:text-title"
      >
        {title}
      </h1>
    </>
  );

  if (slug) {
    return (
      <Link href={`/work/${slug}`} data-work-card={slug} className={CARD_CLASS}>
        {content}
      </Link>
    );
  }

  return (
    <article
      className={CARD_CLASS}
      {...(onOpen ? cardInteraction(onOpen) : {})}
    >
      {content}
    </article>
  );
}

type WorkSliver = {
  title: string;
  onOpen: (element: HTMLElement) => void;
};

type WorkSliversProps = {
  /** Omitted on /, where the slivers stay decorative. */
  items?: WorkSliver[];
  /** Entrance hook (see entrance-cell.tsx); the slivers are items 4-6. */
  entrance?: EntranceVariant;
};

/** Decorative work-column stand-ins; empty by design. */
export function WorkSlivers({ items, entrance }: WorkSliversProps = {}) {
  if (items) {
    return (
      <>
        {items.map((item, index) => {
          const sliver = WORK_SLIVERS[index % WORK_SLIVERS.length];

          return (
            <EntranceCell
              key={item.title}
              variant={entrance}
              item={4 + index}
              row={2}
            >
              <button
                type="button"
                aria-label={`Open case study: ${item.title}`}
                onClick={(event) => item.onOpen(event.currentTarget)}
                className={`wd-sliver ring-host rounded-lg md:h-auto ${sliver.height}`}
              >
                <RingLayers fill={sliver.fill} />
                <span
                  aria-hidden="true"
                  className="wd-sliver-tint"
                  data-index={index}
                />
                <span aria-hidden="true" className="wd-sliver-label">
                  {item.title}
                </span>
              </button>
            </EntranceCell>
          );
        })}
      </>
    );
  }

  return (
    <>
      {WORK_SLIVERS.map((sliver, index) => (
        <EntranceCell key={index} variant={entrance} item={4 + index} row={2}>
          <div
            aria-hidden="true"
            className={`ring-host rounded-lg md:h-auto ${sliver.height}`}
          >
            <RingLayers fill={sliver.fill} />
          </div>
        </EntranceCell>
      ))}
    </>
  );
}

/**
 * Play card shell at its Figma size. The generative art is paused, so the card
 * renders as the empty ring surface (no src/components/play import).
 */
export function PlayCard() {
  return (
    <div aria-hidden="true" className="ring-host flex-1 rounded-lg">
      <RingLayers fill="bg-surface-container-low" />
    </div>
  );
}
