import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { getTodaysArt } from "@/lib/daily-art";
import { ArtCard } from "./art-card/art-card";
import { EMPTY_WORK_LABEL } from "./empty-work";
import { EntranceCell } from "./entrance-cell";
import type { EntranceVariant } from "./entrance-cell";
import { RingLayers } from "./ring-hover";

/**
 * The home page's cards, shared by / and /dev/prototype.
 *
 * The main band is 753 / 180 / 83 / 84 at 1440, 656 / 140 / 64 / 64 at 1024,
 * 444 / 120 / 52 / 52 at 768, with 12px gutters. The cards are intentionally
 * empty: each keeps its Figma box, surface, radius, shadow and ring, with its
 * study's title carried as the link's accessible name. Work slivers have no
 * content in Figma, so they are decorative stand-ins.
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
function cardInteraction(
  onOpen: (element: HTMLElement) => void,
  label: string,
) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
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
  /** The study the card opens; also its accessible name. */
  title?: string;
  /** With a slug the card links to the study and becomes the morph's source. */
  slug?: string;
  onOpen?: (element: HTMLElement) => void;
};

/** The featured card; `.ring-card` is only a marker, every ring host grows by `inset` (ring-hover.css). */
const CARD_CLASS =
  "ring-host ring-card flex h-[420px] flex-col justify-end rounded-lg p-5 md:h-auto md:p-8";

/** The highlight card: an empty surface named after the study it opens. */
export function ProjectCard({
  title = EMPTY_WORK_LABEL,
  slug,
  onOpen,
}: ProjectCardProps = {}) {
  const content = <RingLayers fill="bg-surface-container-low" />;

  if (slug) {
    return (
      <Link
        href={`/work/${slug}`}
        data-work-card={slug}
        aria-label={title}
        className={CARD_CLASS}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className={CARD_CLASS}
      {...(onOpen ? cardInteraction(onOpen, title) : {})}
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
 * The Play card shell now holds the daily painting.
 *
 * The async server child fetches today's pick (cached per UTC day) and hands
 * plain data to the client card. The `typeof window` branch exists only for
 * the client test renderer: home-layout.test.tsx renders this tree in jsdom,
 * where an async server component cannot resolve, and no production route ever
 * executes PlayCard on the client (RSC output is serialized). Keeping the shell
 * sync also keeps the layout test offline.
 */
export function PlayCard() {
  if (typeof window !== "undefined") {
    return (
      <div aria-hidden="true" className="ring-host flex-1 rounded-lg">
        <RingLayers fill="bg-surface-container-low" />
      </div>
    );
  }

  return <DailyArtPlayCard />;
}

async function DailyArtPlayCard() {
  const { art, today, oldest } = await getTodaysArt();

  return <ArtCard initialArt={art} today={today} oldest={oldest} />;
}
