import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_MEDIA } from "../src/components/canvas/items";
import {
  assertAllowed,
  PROTECTED_MEDIA_IDS,
  RETIRED_MEDIA_IDS,
} from "./delete-r2-prefixes";

describe("delete-r2-prefixes guards", () => {
  it("lists 95 unique retired ids", () => {
    expect(RETIRED_MEDIA_IDS).toHaveLength(95);
    expect(new Set(RETIRED_MEDIA_IDS).size).toBe(95);
  });

  it("never lists a protected or live id", () => {
    const live = new Set<string>([
      ...PROTECTED_MEDIA_IDS,
      ...CANVAS_MEDIA.map((item) => item.id),
    ]);
    expect(RETIRED_MEDIA_IDS.filter((id) => live.has(id))).toEqual([]);
  });

  it("has no manifest left for any retired id", () => {
    const present = RETIRED_MEDIA_IDS.filter((id) =>
      existsSync(path.join(process.cwd(), "content", "media", `${id}.json`)),
    );
    expect(present).toEqual([]);
  });

  it("allows keys under a retired prefix", () => {
    expect(() =>
      assertAllowed(`media/${RETIRED_MEDIA_IDS[10]}/w1280.webp`),
    ).not.toThrow();
  });

  it("refuses music, protected ids and outside keys", () => {
    expect(() =>
      assertAllowed(`media/${RETIRED_MEDIA_IDS[10]}/audio.mp3`),
    ).toThrow(/music/);
    expect(() =>
      assertAllowed("media/door-to-the-cosmos-601b1958e1/audio.mp3"),
    ).toThrow();
    expect(() => assertAllowed("media/some-live-id/w1280.webp")).toThrow(
      /outside/,
    );
  });
});
