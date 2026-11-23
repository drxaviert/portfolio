import { describe, expect, it } from "vitest";
import {
  FEATURED_SLUG,
  getWork,
  listWork,
  nextWork,
  parseFrontmatter,
} from "./work";

describe("parseFrontmatter", () => {
  const BODY = "---\ntitle: A study\nrole: Design\n---\n\n# Body\n";

  it("reads a flat block", () => {
    expect(parseFrontmatter(BODY)).toEqual({
      title: "A study",
      role: "Design",
      layout: "reader",
    });
  });

  it("reads the canvas layout and rejects an unknown one", () => {
    const CANVAS = BODY.replace("---\n\n# Body", "layout: canvas\n---\n\n# Body");

    expect(parseFrontmatter(CANVAS).layout).toBe("canvas");
    expect(() =>
      parseFrontmatter(BODY.replace("---\n\n# Body", "layout: sheet\n---\n\n# Body")),
    ).toThrow(/Unknown layout/);
  });

  it("reads a file saved with a UTF-8 BOM", () => {
    expect(parseFrontmatter(`\uFEFF${BODY}`).title).toBe("A study");
  });

  it("reads CRLF line endings", () => {
    const crlf = BODY.replace(/\n/g, "\r\n");

    expect(parseFrontmatter(crlf).title).toBe("A study");
  });

  it("returns nothing when there is no block", () => {
    expect(parseFrontmatter("# Body\n")).toEqual({});
  });
});

describe("listWork", () => {
  it("returns the three visible case studies", () => {
    expect(listWork()).toHaveLength(3);
  });

  it("gives every visible study a known cover", () => {
    for (const work of listWork()) {
      expect(work.cover).toMatch(
        /^(tiles|window|phone|media:[a-z0-9][a-z0-9-]*)$/,
      );
    }
  });

  it("keeps the visible reading order stable", () => {
    expect(listWork().map((work) => work.slug)).toEqual([
      "systems-in-motion",
      "title-sequence",
      "type-in-motion",
    ]);
  });
});

describe("getWork", () => {
  it("reads the featured study and its tiles cover", () => {
    expect(getWork(FEATURED_SLUG)?.cover).toBe("tiles");
    expect(getWork(FEATURED_SLUG)?.layout).toBe("reader");
  });

  it("hides Motion & Stills while its content stays in the repo", () => {
    expect(getWork("motion-and-stills")).toBeNull();
    expect(listWork().map((work) => work.slug)).not.toContain(
      "motion-and-stills",
    );
  });

  it("returns null for an unknown slug", () => {
    expect(getWork("nope")).toBeNull();
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("systems-in-motion").slug).toBe("title-sequence");
  });

  it("wraps from the last visible study back to the first", () => {
    expect(nextWork("type-in-motion").slug).toBe("systems-in-motion");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("systems-in-motion");
  });
});
