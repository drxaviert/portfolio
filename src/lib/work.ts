import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { coverImageFor } from "./media";
import type { CoverImage } from "./media";
import { FEATURED_SLUG } from "./work-order";

// Flat `key: value` frontmatter is shared with the play feed. Re-exported so
// the case-study callers and tests keep one entry point.
export { parseFrontmatter };

export type CoverScene = "tiles" | "window" | "phone";

/** A drawn scene, or a media id that resolves to a manifest picture. */
export type Cover = CoverScene | `media:${string}`;

export { FEATURED_SLUG };

/** Reading order for the list and for the wrap-around next-study link. */
const WORK_ORDER = [
  "systems-in-motion",
  "title-sequence",
  "type-in-motion",
] as const;

export type WorkSlug = (typeof WORK_ORDER)[number];

export type WorkMeta = {
  slug: WorkSlug;
  title: string;
  subtitle: string;
  year: string;
  role: string;
  summary: string;
  cover: Cover;
  /** Set when `cover` is a media id: the picture the cover slots draw. */
  coverImage?: CoverImage;
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

function readWork(slug: WorkSlug): WorkMeta {
  const file = path.join(CONTENT_DIR, `${slug}.mdx`);
  const fields = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const { title, subtitle, year, role, summary, cover } = fields;
  const missing = [
    ["title", title],
    ["subtitle", subtitle],
    ["year", year],
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

  return {
    slug,
    title,
    subtitle,
    year,
    role,
    summary,
    cover,
    ...(cover.startsWith("media:")
      ? { coverImage: coverImageFor(cover.slice("media:".length)) }
      : {}),
  };
}

export function listWork(): WorkMeta[] {
  return WORK_ORDER.map(readWork);
}

export function getWork(slug: string): WorkMeta | null {
  return isWorkSlug(slug) ? readWork(slug) : null;
}

/** The study after `slug` in reading order; the last one wraps to the first. */
export function nextWork(slug: string): WorkMeta {
  const index = isWorkSlug(slug) ? WORK_ORDER.indexOf(slug) : -1;
  return readWork(WORK_ORDER[(index + 1) % WORK_ORDER.length]);
}
