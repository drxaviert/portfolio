import { describe, expect, it } from "vitest";
import { WORK_BODIES } from "../src/lib/work-bodies.ts";
import { assertStudySlug } from "./post.ts";

const SLUGS = Object.keys(WORK_BODIES);

describe("assertStudySlug", () => {
  it("accepts every study the site can open", () => {
    for (const slug of SLUGS) {
      expect(() => assertStudySlug(slug)).not.toThrow();
    }
  });

  it("rejects an unknown slug and names the valid ones", () => {
    expect(() => assertStudySlug("not-a-real-study")).toThrow(
      `unknown study slug "not-a-real-study"; expected one of: ${SLUGS.join(", ")}`,
    );
  });

  it("does not trim or accept a near miss", () => {
    expect(() => assertStudySlug("systems-in-motion ")).toThrow(
      "unknown study slug",
    );
  });
});
