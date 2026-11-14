import { describe, expect, it } from "vitest";
import { FEATURED_SLUG, getWork, listWork } from "./work";

const COVERS = ["tiles", "window", "phone"];

describe("listWork", () => {
  it("returns the three case studies", () => {
    expect(listWork()).toHaveLength(3);
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

describe("FEATURED_SLUG", () => {
  it("is the study with the homepage card", () => {
    expect(FEATURED_SLUG).toBe("systems-in-motion");
  });
});
