import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_MEDIA } from "../src/components/canvas/items";
import {
  assertAllowed,
  findOrphans,
  PROTECTED_MEDIA_IDS,
  RETIRED_MEDIA_IDS,
} from "./delete-r2-prefixes";

describe("delete-r2-prefixes guards", () => {
  it("lists 100 unique retired ids", () => {
    expect(RETIRED_MEDIA_IDS).toHaveLength(100);
    expect(new Set(RETIRED_MEDIA_IDS).size).toBe(100);
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

describe("findOrphans", () => {
  const base = "https://cdn.example/media";
  const manifests = new Map<string, unknown>([
    [
      "clip-1",
      {
        mp4: { url: `${base}/clip-1/video.mp4` },
        canvas: { url: `${base}/clip-1/canvas.mp4` },
        poster: { jpg: `${base}/clip-1/poster.jpg` },
      },
    ],
    ["door-to-the-cosmos-601b1958e1", {}],
  ]);
  const keys = [
    "media/clip-1/video.mp4",
    "media/clip-1/canvas.mp4",
    "media/clip-1/poster.jpg",
    "media/clip-1/hls/720p/seg0.ts",
    "media/clip-1/w1280.webp",
    "media/clip-1/audio.mp3",
    "media/no-manifest/hls/a.ts",
    "media/door-to-the-cosmos-601b1958e1/cover.jpg",
    "other/clip-1/x.mp4",
  ];

  it("returns only unreferenced keys of ids with a manifest, never music", () => {
    const orphans = findOrphans(
      keys.map((key) => ({ key, bytes: 1 })),
      manifests,
    ).map((object) => object.key);
    expect(orphans).toEqual([
      "media/clip-1/hls/720p/seg0.ts",
      "media/clip-1/w1280.webp",
    ]);
  });
});
