import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";

/**
 * One entry in `/play`. The file is frontmatter only: the feed draws the media,
 * not a body, so `pnpm post --post` can write one without an MDX pipeline.
 */
export type Post = {
  /** The filename without `.mdx`, used as the list key. */
  slug: string;
  title: string;
  /** ISO 8601, as written in the frontmatter. */
  date: string;
  /** Optional line under the title. */
  summary?: string;
  /** Manifest ids in `content/media/`, in the order they should render. */
  media: string[];
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

/**
 * `media: ["id", "id"]`, as `pnpm post --post` writes it, or a bare
 * `media: id`. The values stay unvalidated here: `<Media>` resolves each one
 * against its manifest, so a typo still fails the build at render.
 */
export function parseMediaIds(value: string | undefined): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  const inner =
    trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1)
      : trimmed;

  return inner
    .split(",")
    .map((part) => unquote(part.trim()))
    .filter(Boolean);
}

function unquote(value: string): string {
  const first = value[0];
  const quote = first === '"' || first === "'" ? first : undefined;

  return quote && value.length > 1 && value.endsWith(quote)
    ? value.slice(1, -1)
    : value;
}

/**
 * Reads one post. `caption` is what `pnpm post --post` writes, so it stands in
 * for a title; a hand-written file can use either. Missing fields and an
 * unparseable date throw, which fails the build: a feed entry without a title,
 * a date or media is a mistake, not an empty frame.
 */
export function parsePost(source: string, slug: string): Post {
  const fields = parseFrontmatter(source);
  // `pnpm post --post` JSON-quotes its values; hand-written files are plain.
  const title = unquote(fields.title || fields.caption || "");
  const date = unquote(fields.date ?? "");
  const summary = unquote(fields.summary ?? "");
  const media = parseMediaIds(fields.media);

  const missing = [
    ["title", title],
    ["date", date],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `content/posts/${slug}.mdx is missing frontmatter: ${missing.join(", ")}`,
    );
  }

  if (media.length === 0) {
    throw new Error(
      `content/posts/${slug}.mdx has no media; expected media: ["<id>", ...]`,
    );
  }

  if (Number.isNaN(Date.parse(date))) {
    throw new Error(
      `content/posts/${slug}.mdx has date "${date}"; expected an ISO 8601 date such as 2026-11-19`,
    );
  }

  return {
    slug,
    title,
    date,
    ...(summary ? { summary } : {}),
    media,
  };
}

/** Newest first. Equal dates fall back to the slug so the order is stable. */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const byDate = Date.parse(b.date) - Date.parse(a.date);

    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
  });
}

/**
 * Every `.mdx` in `content/posts/`, newest first. Synchronous like `listWork`:
 * the files are committed, so a new post means a rebuild or a dev restart.
 */
export function listPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const posts = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) =>
      parsePost(
        fs.readFileSync(path.join(POSTS_DIR, name), "utf8"),
        name.slice(0, -".mdx".length),
      ),
    );

  return sortPosts(posts);
}
