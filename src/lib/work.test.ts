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

  it("reads the hidden switch", () => {
    const HIDDEN = BODY.replace("---\n\n# Body", "hidden: true\n---\n\n# Body");

    expect(parseFrontmatter(HIDDEN).hidden).toBe("true");
  });

  it("returns nothing when there is no block", () => {
    expect(parseFrontmatter("# Body\n")).toEqual({});
  });
});

describe("listWork", () => {
  it("returns the visible case studies", () => {
    expect(listWork()).toHaveLength(4);
  });

  it("gives every study a known cover", () => {
    for (const work of listWork()) {
      expect(work.cover).toMatch(
        /^(tiles|window|phone|media:[a-z0-9][a-z0-9-]*)$/,
      );
    }
  });

  it("keeps the reading order stable", () => {
    expect(listWork().map((work) => work.slug)).toEqual([
      "systems-in-motion",
      "title-sequence",
      "type-in-motion",
      "motion-and-stills",
    ]);
  });

  it("leaves the study behind the hidden switch out of the list", () => {
    expect(listWork().map((work) => work.slug)).not.toContain("human-contact");
  });
});

describe("getWork", () => {
  it("reads the featured study and its tiles cover", () => {
    expect(getWork(FEATURED_SLUG)?.cover).toBe("tiles");
    expect(getWork(FEATURED_SLUG)?.layout).toBe("reader");
  });

  it("reads Motion & Stills as the canvas study", () => {
    const work = getWork("motion-and-stills");

    expect(work?.layout).toBe("canvas");
    expect(work?.cover).toBe("media:good-form-reel-4c969cc977");
    expect(work?.coverImage?.width).toBeGreaterThan(0);
  });

  it("returns null for an unknown slug", () => {
    expect(getWork("nope")).toBeNull();
  });

  it("returns null for a hidden study, so its routes 404", () => {
    expect(getWork("human-contact")).toBeNull();
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("systems-in-motion").slug).toBe("title-sequence");
  });

  it("steps from the third study to the canvas study", () => {
    expect(nextWork("type-in-motion").slug).toBe("motion-and-stills");
  });

  it("skips the hidden study and wraps from the canvas study to the first", () => {
    expect(nextWork("motion-and-stills").slug).toBe("systems-in-motion");
  });

  it("treats a hidden slug as the end of the reading order", () => {
    expect(nextWork("human-contact").slug).toBe("systems-in-motion");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("systems-in-motion");
  });
});
