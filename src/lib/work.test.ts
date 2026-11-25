import { describe, expect, it } from "vitest";
import {
  FEATURED_SLUG,
  getWork,
  listWork,
  nextWork,
  parseFrontmatter,
} from "./work";

const COVERS = ["tiles", "window", "phone"];

describe("parseFrontmatter", () => {
  const BODY = "---\ntitle: A study\nrole: Design\n---\n\n# Body\n";

  it("reads a flat block", () => {
    expect(parseFrontmatter(BODY)).toEqual({
      title: "A study",
      role: "Design",
    });
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
  it("returns the twenty case studies", () => {
    expect(listWork()).toHaveLength(20);
  });

  it("gives every study a known cover", () => {
    for (const work of listWork()) {
      expect(COVERS).toContain(work.cover);
    }
  });

  it("keeps the reading order stable", () => {
    expect(listWork().map((work) => work.slug)).toEqual([
      "ai-agents-google",
      "klaris",
      "shapes-in-motion",
      "growth-factors-deciem",
      "cellixir",
      "tribeca-film-festival-deciem",
      "urban-decay",
      "niod-deciem",
      "eroxon",
      "good-form-rebrand",
      "xylo-audio",
      "lullavibes",
      "docebo-ai-capabilities",
      "cash-app-cash-flow",
      "metaview",
      "2d-motion-design-introduction",
      "linksys",
      "london-public-library",
      "personal",
      "about-dat",
    ]);
  });
});

describe("getWork", () => {
  it("reads the featured study and its window cover", () => {
    expect(getWork(FEATURED_SLUG)?.cover).toBe("window");
  });

  it("returns null for an unknown slug", () => {
    expect(getWork("nope")).toBeNull();
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("ai-agents-google").slug).toBe("klaris");
  });

  it("wraps from the last study back to the first", () => {
    expect(nextWork("about-dat").slug).toBe("ai-agents-google");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("ai-agents-google");
  });
});
