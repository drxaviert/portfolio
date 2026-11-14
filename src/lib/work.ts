import fs from "node:fs";
import path from "node:path";

export type Cover = "tiles" | "window" | "phone";

export type WorkMeta = {
  slug: string;
  title: string;
  subtitle: string;
  year: string;
  role: string;
  summary: string;
  cover: Cover;
};

/** The one study with a card on the homepage. */
export const FEATURED_SLUG = "systems-in-motion";

/** Reading order for the list and for the wrap-around next-study link. */
const WORK_ORDER = [
  "systems-in-motion",
  "title-sequence",
  "type-in-motion",
] as const;

type WorkSlug = (typeof WORK_ORDER)[number];

const WORK_SLUGS: readonly string[] = WORK_ORDER;
const COVERS: readonly string[] = ["tiles", "window", "phone"];

const CONTENT_DIR = path.join(process.cwd(), "content", "work");

function isWorkSlug(value: string): value is WorkSlug {
  return WORK_SLUGS.includes(value);
}

function isCover(value: string | undefined): value is Cover {
  return value !== undefined && COVERS.includes(value);
}

/**
 * Flat `key: value` frontmatter, split at the first colon so a value may
 * contain one. The content files are ours, so this stays deliberately small.
 */
function parseFrontmatter(source: string): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!block) return {};

  const fields: Record<string, string> = {};

  for (const line of block[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    fields[key] = line.slice(colon + 1).trim();
  }

  return fields;
}

function readWork(slug: WorkSlug): WorkMeta {
  const file = path.join(CONTENT_DIR, `${slug}.mdx`);
  const fields = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const { title, subtitle, year, role, summary, cover } = fields;

  if (!title || !subtitle || !year || !role || !summary) {
    throw new Error(`content/work/${slug}.mdx is missing a frontmatter field`);
  }

  if (!isCover(cover)) {
    throw new Error(
      `content/work/${slug}.mdx has cover "${cover ?? ""}"; expected tiles, window or phone`,
    );
  }

  return { slug, title, subtitle, year, role, summary, cover };
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
