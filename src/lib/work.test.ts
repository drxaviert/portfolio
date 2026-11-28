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
    const CANVAS = BODY.replace(
      "---\n\n# Body",
      "layout: canvas\n---\n\n# Body",
    );

    expect(parseFrontmatter(CANVAS).layout).toBe("canvas");
    expect(() =>
      parseFrontmatter(
        BODY.replace("---\n\n# Body", "layout: sheet\n---\n\n# Body"),
      ),
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
    expect(listWork()).toHaveLength(18);
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
      "cash-app-cash-flow",
      "metaview",
      "linksys",
      "london-public-library",
      "motion-and-stills",
      "personal",
    ]);
  });

  it("leaves the study behind the hidden switch out of the list", () => {
    expect(listWork().map((work) => work.slug)).not.toContain("human-contact");
  });
});

describe("getWork", () => {
  it("reads the featured study and its window cover", () => {
    expect(getWork(FEATURED_SLUG)?.cover).toBe("window");
    expect(getWork(FEATURED_SLUG)?.layout).toBe("reader");
  });

  it("reads Motion & Stills as the canvas study", () => {
    const work = getWork("motion-and-stills");

    expect(work?.layout).toBe("canvas");
    expect(work?.cover).toBe("media:good-form-reel-3ab73b7312");
    expect(work?.coverImage?.width).toBeGreaterThan(0);
  });

  it("gives every study but Motion & Stills a hover video from its canvas encode", () => {
    for (const work of listWork()) {
      if (work.slug === "motion-and-stills") {
        expect(work.thumbVideo).toBeUndefined();
        expect(work.thumbImage?.avif).toContain(
          "motion-and-stills-grid-b20ba19d14",
        );
        continue;
      }

      expect(work.thumbVideo?.src, work.slug).toMatch(/\/canvas\.mp4$/);
      expect(work.thumbVideo?.poster, work.slug).toMatch(/\/poster\.jpg$/);
    }
  });

  it("plays the named video for each study", () => {
    expect(getWork("tribeca-film-festival-deciem")?.thumbVideo?.src).toContain(
      "ord-sv-ripple-01h-hd-prob4-3554f8ab40",
    );
    expect(getWork("personal")?.thumbVideo?.src).toContain(
      "flower-nosound-7512432863",
    );
  });

  it("returns null for an unknown slug", () => {
    expect(getWork("nope")).toBeNull();
  });

  it("returns null for a hidden study, so its routes 404", () => {
    expect(getWork("human-contact")).toBeNull();
  });
});

describe("year", () => {
  it("keeps the year on dated studies", () => {
    expect(getWork("klaris")?.year).toBe("2025");
  });

  it("reads ongoing studies as Current", () => {
    expect(getWork("personal")?.year).toBe("Current");
    expect(getWork("motion-and-stills")?.year).toBe("Current");
  });
});

describe("nextWork", () => {
  it("returns the following study in reading order", () => {
    expect(nextWork("ai-agents-google").slug).toBe("klaris");
  });

  it("steps from the last 2D study to the canvas study", () => {
    expect(nextWork("london-public-library").slug).toBe("motion-and-stills");
  });

  it("skips the hidden study between the canvas study and personal", () => {
    expect(nextWork("motion-and-stills").slug).toBe("personal");
  });

  it("wraps from the last study back to the first", () => {
    expect(nextWork("personal").slug).toBe("ai-agents-google");
  });

  it("treats a hidden slug as the end of the reading order", () => {
    expect(nextWork("human-contact").slug).toBe("ai-agents-google");
  });
});

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("ai-agents-google");
  });
});
