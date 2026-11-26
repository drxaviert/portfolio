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
  it("returns the sixteen case studies", () => {
    expect(listWork()).toHaveLength(16);
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
      "good-form-rebrand",
      "xylo-audio",
      "lullavibes",
      "cash-app-cash-flow",
      "metaview",
      "linksys",
      "london-public-library",
      "personal",
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

describe("year", () => {
  it("keeps the year on dated studies", () => {
    expect(getWork("klaris")?.year).toBe("2025");
  });

  it("omits the optional year when the study has none", () => {
    const personal = getWork("personal");

    expect(personal).not.toBeNull();
    expect(personal && "year" in personal).toBe(false);
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("ai-agents-google").slug).toBe("klaris");
  });

  it("wraps from the last study back to the first", () => {
    expect(nextWork("personal").slug).toBe("ai-agents-google");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("ai-agents-google");
  });
});
