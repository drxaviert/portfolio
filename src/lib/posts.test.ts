import { describe, expect, it } from "vitest";
import { listPosts, parseMediaIds, parsePost, sortPosts } from "./posts";
import type { Post } from "./posts";

const SOURCE = [
  "---",
  "title: A test post",
  "date: 2026-11-19",
  "summary: One line under the title.",
  'media: ["pipeline-test-still-4a9b86e544", "pipeline-test-loop-c0fe9c23ef"]',
  "---",
  "",
].join("\n");

describe("parseMediaIds", () => {
  it("reads the inline array pnpm post writes", () => {
    expect(
      parseMediaIds(
        '["pipeline-test-still-4a9b86e544", "pipeline-test-loop-c0fe9c23ef"]',
      ),
    ).toEqual([
      "pipeline-test-still-4a9b86e544",
      "pipeline-test-loop-c0fe9c23ef",
    ]);
  });

  it("reads a single id, quoted or bare", () => {
    expect(parseMediaIds('"pipeline-test-still-4a9b86e544"')).toEqual([
      "pipeline-test-still-4a9b86e544",
    ]);
    expect(parseMediaIds("pipeline-test-still-4a9b86e544")).toEqual([
      "pipeline-test-still-4a9b86e544",
    ]);
  });

  it("reads an empty or absent list", () => {
    expect(parseMediaIds("[]")).toEqual([]);
    expect(parseMediaIds("")).toEqual([]);
    expect(parseMediaIds(undefined)).toEqual([]);
  });

  it("keeps a list on one line regardless of spacing", () => {
    expect(parseMediaIds("[ 'a', \"b\" ]")).toEqual(["a", "b"]);
  });
});

describe("parsePost", () => {
  it("reads title, date, summary and media", () => {
    expect(parsePost(SOURCE, "2026-11-19-pipeline-test")).toEqual({
      slug: "2026-11-19-pipeline-test",
      title: "A test post",
      date: "2026-11-19",
      summary: "One line under the title.",
      media: [
        "pipeline-test-still-4a9b86e544",
        "pipeline-test-loop-c0fe9c23ef",
      ],
    });
  });

  it("leaves summary out when there is none", () => {
    const source = SOURCE.replace("summary: One line under the title.\n", "");

    expect(parsePost(source, "post")).not.toHaveProperty("summary");
  });

  it("uses the caption pnpm post --post writes as the title", () => {
    const source = [
      "---",
      "date: 2026-11-19",
      'caption: "A test post"',
      'media: ["pipeline-test-still-4a9b86e544"]',
      "---",
      "",
    ].join("\n");

    expect(parsePost(source, "post").title).toBe("A test post");
  });

  it("names the file when a required field is missing", () => {
    const source = SOURCE.replace("date: 2026-11-19\n", "");

    expect(() => parsePost(source, "draft")).toThrow(
      "content/posts/draft.mdx is missing frontmatter: date",
    );
  });

  it("rejects a post with no media", () => {
    const source = SOURCE.replace(/^media: .*$/m, "media: []");

    expect(() => parsePost(source, "draft")).toThrow(
      'content/posts/draft.mdx has no media; expected media: ["<id>", ...]',
    );
  });

  it("rejects a date that is not parseable", () => {
    const source = SOURCE.replace("date: 2026-11-19", "date: last tuesday");

    expect(() => parsePost(source, "draft")).toThrow(
      'content/posts/draft.mdx has date "last tuesday"',
    );
  });
});

describe("sortPosts", () => {
  const post = (slug: string, date: string): Post => ({
    slug,
    title: slug,
    date,
    media: ["pipeline-test-still-4a9b86e544"],
  });

  it("puts the newest date first", () => {
    const sorted = sortPosts([
      post("older", "2026-01-02"),
      post("newest", "2026-11-19"),
      post("middle", "2026-06-01"),
    ]);

    expect(sorted.map((entry) => entry.slug)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  it("breaks a date tie by slug so the order is stable", () => {
    const sorted = sortPosts([
      post("b-second", "2026-11-19"),
      post("a-first", "2026-11-19"),
    ]);

    expect(sorted.map((entry) => entry.slug)).toEqual(["a-first", "b-second"]);
  });

  it("does not mutate the input", () => {
    const posts = [post("older", "2026-01-02"), post("newer", "2026-11-19")];
    sortPosts(posts);

    expect(posts.map((entry) => entry.slug)).toEqual(["older", "newer"]);
  });
});

describe("listPosts", () => {
  it("reads the posts in content/posts", () => {
    const posts = listPosts();

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0].title).toBe("Pipeline test");
    expect(posts[0].media).toEqual([
      "pipeline-test-still-4a9b86e544",
      "pipeline-test-loop-c0fe9c23ef",
    ]);
  });

  it("returns them newest first", () => {
    const dates = listPosts().map((post) => Date.parse(post.date));

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
