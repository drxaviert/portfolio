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
  it("returns the four case studies", () => {
    expect(listWork()).toHaveLength(4);
  });

  it("gives every study a known cover", () => {
    for (const work of listWork()) {
      expect(COVERS).toContain(work.cover);
    }
  });

  it("keeps the reading order stable", () => {
    expect(listWork().map((work) => work.slug)).toEqual([
      "systems-in-motion",
      "title-sequence",
      "type-in-motion",
      "human-contact",
    ]);
  });
});

describe("getWork", () => {
  it("reads the featured study and its tiles cover", () => {
    expect(getWork(FEATURED_SLUG)?.cover).toBe("tiles");
  });

  it("returns null for an unknown slug", () => {
    expect(getWork("nope")).toBeNull();
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("systems-in-motion").slug).toBe("title-sequence");
  });

  it("steps from the third study to the newest one", () => {
    expect(nextWork("type-in-motion").slug).toBe("human-contact");
  });

  it("wraps from the last study back to the first", () => {
    expect(nextWork("human-contact").slug).toBe("systems-in-motion");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("systems-in-motion");
  });
});
