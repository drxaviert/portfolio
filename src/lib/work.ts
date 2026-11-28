import fs from "node:fs";
import path from "node:path";
import { coverImageFor, getMedia, thumbVideoFor } from "./media";
import type { CoverImage, ThumbVideo } from "./media";
import { FEATURED_SLUG } from "./work-order";

export type CoverScene = "tiles" | "window" | "phone";

/** A drawn scene, or a media id that resolves to a manifest picture. */
export type Cover = CoverScene | `media:${string}`;

export type WorkLayout = "reader" | "canvas";

export { FEATURED_SLUG };

/** Reading order for the list and for the wrap-around next-study link. */
const WORK_ORDER = [
  // 3D work, in the live site's order.
  "ai-agents-google",
  "klaris",
  "shapes-in-motion",
  "growth-factors-deciem",
  "celixir",
  "tribeca-film-festival-deciem",
  "urban-decay",
  "niod-deciem",
  "good-form-rebrand",
  "attitude",
  "xylo-audio",
  "lullavibes",
  // 2D work.
  "cash-app-cash-flow",
  "metaview",
  "linksys",
  "london-public-library",
  // Studies built for this site.
  "motion-and-stills",
  "human-contact",
  // The personal page.
  "personal",
] as const;

export type WorkSlug = (typeof WORK_ORDER)[number];

export type WorkMeta = {
  slug: WorkSlug;
  title: string;
  subtitle: string;
  /** Optional: the personal study has no year on the live site. */
  year?: string;
  role: string;
  summary: string;
  cover: Cover;
  /** How the study renders; omitted means the Margin reader. */
  layout?: WorkLayout;
  /** Set when `cover` is a media id: the picture the cover slots draw. */
  coverImage?: CoverImage;
  /**
   * `thumb: media:<id>` in frontmatter: what the /work hover shows instead of
   * the cover. A video id plays its canvas encode; an image id is a still.
   */
  thumbVideo?: ThumbVideo;
  thumbImage?: CoverImage;
  /**
   * `hidden: true` in the file's frontmatter: the study stays in the repo and
   * in `WORK_BODIES`, but every listing filters it out and its routes 404.
   */
  hidden: boolean;
};

const WORK_SLUGS: readonly string[] = WORK_ORDER;
const COVERS: readonly string[] = ["tiles", "window", "phone"];
const MEDIA_COVER = /^media:([a-z0-9][a-z0-9-]*)$/;

const CONTENT_DIR = path.join(process.cwd(), "content", "work");

function isWorkSlug(value: string): value is WorkSlug {
  return WORK_SLUGS.includes(value);
}

function isCover(value: string | undefined): value is Cover {
  return (
    value !== undefined && (COVERS.includes(value) || MEDIA_COVER.test(value))
  );
}

/**
 * Flat `key: value` frontmatter, split at the first colon so a value may
 * contain one. The content files are ours, so this stays deliberately small.
 * A saved-with-BOM file is still frontmatter: the editor's mark is not content.
 */
export function parseFrontmatter(source: string): Record<string, string> {
  const block = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!block) return {};

  const fields: Record<string, string> = {};

  for (const line of block[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    fields[key] = line.slice(colon + 1).trim();
  }

  const layout = fields.layout ?? "reader";

  if (layout !== "reader" && layout !== "canvas") {
    throw new Error(
      `Unknown layout "${layout}" in frontmatter; expected reader or canvas`,
    );
  }

  fields.layout = layout;

  return fields;
}

function readWork(slug: WorkSlug): WorkMeta {
  const file = path.join(CONTENT_DIR, `${slug}.mdx`);
  const fields = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const { title, subtitle, year, role, summary, cover, thumb, layout, hidden } =
    fields;
  const missing = [
    ["title", title],
    ["subtitle", subtitle],
    ["role", role],
    ["summary", summary],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `content/work/${slug}.mdx is missing frontmatter: ${missing.join(", ")}`,
    );
  }

  if (!isCover(cover)) {
    throw new Error(
      `content/work/${slug}.mdx has cover "${cover ?? ""}"; expected tiles, window, phone or media:<id>`,
    );
  }

  const thumbId = thumb ? MEDIA_COVER.exec(thumb)?.[1] : undefined;

  if (thumb && !thumbId) {
    throw new Error(
      `content/work/${slug}.mdx has thumb "${thumb}"; expected media:<id>`,
    );
  }

  return {
    slug,
    title,
    subtitle,
    ...(year ? { year } : {}),
    role,
    summary,
    cover,
    layout: layout === "canvas" ? "canvas" : "reader",
    hidden: hidden === "true",
    ...(cover.startsWith("media:")
      ? { coverImage: coverImageFor(cover.slice("media:".length)) }
      : {}),
    ...(thumbId
      ? getMedia(thumbId).kind === "video"
        ? { thumbVideo: thumbVideoFor(thumbId) }
        : { thumbImage: coverImageFor(thumbId) }
      : {}),
  };
}

/** The studies on the site: every file in reading order that is not sunset. */
export function listWork(): WorkMeta[] {
  return WORK_ORDER.map(readWork).filter((work) => !work.hidden);
}

/** One visible study; a hidden or unknown slug resolves to null (a 404). */
export function getWork(slug: string): WorkMeta | null {
  if (!isWorkSlug(slug)) return null;

  const work = readWork(slug);
  return work.hidden ? null : work;
}

/** The visible study after `slug`; the last one wraps to the first. */
export function nextWork(slug: string): WorkMeta {
  const works = listWork();
  const index = works.findIndex((work) => work.slug === slug);
  return works[(index + 1) % works.length]!;
}
