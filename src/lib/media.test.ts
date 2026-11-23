import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverImageFor, getMedia, listMedia, validateManifest } from "./media";
import { sourceSet } from "@/components/media/source-set";

const IMAGE_ID = "pipeline-test-still-4a9b86e544";
const VIDEO_ID = "pipeline-test-loop-c0fe9c23ef";

describe("getMedia", () => {
  it("reads and sorts an image manifest", () => {
    const media = getMedia(IMAGE_ID);

    expect(media.kind).toBe("image");
    expect(media.width).toBe(1600);
    if (media.kind !== "image") return;

    expect(media.sources.map((source) => source.width)).toEqual([
      640, 640, 1280, 1280, 1600, 1600,
    ]);
    expect(media.lqip.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("reads a video manifest and its optional WebM", () => {
    const media = getMedia(VIDEO_ID);

    expect(media.kind).toBe("video");
    if (media.kind !== "video") return;

    expect(media.mp4.url).toMatch(
      /^https:\/\/.+\.public\.blob\.vercel-storage\.com\//,
    );
    expect(media.webm?.url).toMatch(/\.webm$/);
    expect(media.poster.avif).toMatch(/\.avif$/);
    expect(media.poster.jpg).toMatch(/\.jpg$/);
  });

  it("throws for an id with no manifest", () => {
    expect(() => getMedia("nope")).toThrow(/content\/media\/nope\.json/);
  });

  it("throws before touching the filesystem for a malformed id", () => {
    expect(() => getMedia("../work/systems-in-motion")).toThrow(
      /not a media id/,
    );
  });
});

describe("listMedia", () => {
  const manifestIds = () =>
    fs
      .readdirSync(path.join(process.cwd(), "content", "media"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(/\.json$/, ""));

  it("lists every manifest in content/media, once", () => {
    const listed = listMedia().map((media) => media.id);

    expect(listed).toHaveLength(manifestIds().length);
    expect([...listed].sort()).toEqual([...manifestIds()].sort());
  });

  it("sorts newest first by createdAt", () => {
    const dates = listMedia().map((media) => Date.parse(media.createdAt));

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("returns the validated manifest getMedia returns", () => {
    for (const media of listMedia()) {
      expect(media).toBe(getMedia(media.id));
    }
  });
});

describe("coverImageFor", () => {
  it("takes the 1280 variants, not the full-size original", () => {
    const cover = coverImageFor(IMAGE_ID);

    expect(cover.avif).toMatch(/w1280\.avif$/);
    expect(cover.fallback).toMatch(/w1280\.webp$/);
    expect(cover.fallbackType).toBe("image/webp");
    expect(cover.width).toBe(1600);
    expect(cover.lqip).toMatch(/^data:image\//);
  });

  it("uses the poster for a video cover", () => {
    const cover = coverImageFor(VIDEO_ID);

    expect(cover.avif).toMatch(/poster\.avif$/);
    expect(cover.fallback).toMatch(/poster\.jpg$/);
    expect(cover.fallbackType).toBe("image/jpeg");
  });
});

describe("validateManifest", () => {
  const image = () => ({
    id: "test-0000000000",
    kind: "image",
    width: 800,
    height: 450,
    alt: "",
    caption: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    original: "test.png",
    sources: [
      {
        format: "avif",
        width: 640,
        url: "https://example.public.blob.vercel-storage.com/test/w640.avif",
      },
    ],
    lqip: "data:image/webp;base64,AAAA",
  });

  it("accepts the shape post.ts writes", () => {
    expect(validateManifest("test-0000000000", image()).kind).toBe("image");
  });

  it("rejects a manifest whose id does not match its filename", () => {
    expect(() => validateManifest("other", image())).toThrow(/id is/);
  });

  it("rejects an unsupported image format", () => {
    const broken = image();
    broken.sources[0].format = "jpg";

    expect(() => validateManifest("test-0000000000", broken)).toThrow(
      /format must be avif or webp/,
    );
  });

  it("rejects a missing lqip", () => {
    const broken = { ...image(), lqip: undefined };

    expect(() => validateManifest("test-0000000000", broken)).toThrow(/lqip/);
  });

  it("rejects a video without an mp4", () => {
    expect(() =>
      validateManifest("test-0000000000", {
        ...image(),
        kind: "video",
        poster: { avif: "https://x/y.avif", jpg: "https://x/y.jpg" },
        duration: 1,
        hasAudio: true,
      }),
    ).toThrow(/mp4/);
  });

  const video = () => ({
    ...image(),
    kind: "video",
    mp4: {
      url: "https://example.public.blob.vercel-storage.com/test/video.mp4",
      bytes: 1200,
    },
    poster: { avif: "https://x/y.avif", jpg: "https://x/y.jpg" },
    duration: 61.2,
    hasAudio: true,
  });

  it("accepts an hls ladder on a video", () => {
    const manifest = {
      ...video(),
      hls: {
        url: "https://example.public.blob.vercel-storage.com/test/hls/master.m3u8",
        bytes: 24_000_000,
        levels: [
          { height: 1080, bandwidth: 5_000_000 },
          { height: 720, bandwidth: 2_800_000 },
          { height: 480, bandwidth: 1_200_000 },
        ],
      },
    };

    const parsed = validateManifest("test-0000000000", manifest);

    expect(parsed.kind).toBe("video");
    if (parsed.kind !== "video") return;
    expect(parsed.hls?.levels.map((level) => level.height)).toEqual([
      1080, 720, 480,
    ]);
  });

  it("rejects an hls master that is not an https .m3u8", () => {
    const manifest = {
      ...video(),
      hls: { url: "https://x/master.mp4", bytes: 1, levels: [] },
    };

    expect(() => validateManifest("test-0000000000", manifest)).toThrow(
      /hls\.url must be an https URL ending in \.m3u8/,
    );
  });

  it("rejects an hls block with no bytes", () => {
    const manifest = {
      ...video(),
      hls: {
        url: "https://x/master.m3u8",
        bytes: 0,
        levels: [{ height: 480, bandwidth: 1 }],
      },
    };

    expect(() => validateManifest("test-0000000000", manifest)).toThrow(
      /hls\.bytes must be a positive integer/,
    );
  });

  it("rejects an hls block with empty or bad levels", () => {
    const empty = {
      ...video(),
      hls: { url: "https://x/master.m3u8", bytes: 1, levels: [] },
    };
    expect(() => validateManifest("test-0000000000", empty)).toThrow(
      /hls\.levels must be a non-empty array/,
    );

    const bad = {
      ...video(),
      hls: {
        url: "https://x/master.m3u8",
        bytes: 1,
        levels: [{ height: 480, bandwidth: 0 }],
      },
    };
    expect(() => validateManifest("test-0000000000", bad)).toThrow(
      /hls\.levels\[0\]\.bandwidth must be a positive number/,
    );
  });

  it("accepts an optional canvas rendition", () => {
    const manifest = {
      ...video(),
      canvas: {
        url: "https://example.public.blob.vercel-storage.com/test/canvas.mp4",
        bytes: 800_000,
      },
    };

    const parsed = validateManifest("test-0000000000", manifest);

    expect(parsed.kind).toBe("video");
    if (parsed.kind !== "video") return;
    expect(parsed.canvas?.url).toMatch(/canvas\.mp4$/);
    expect(parsed.canvas?.bytes).toBe(800_000);
  });

  it("rejects a canvas rendition with a bad url or bytes", () => {
    const badUrl = {
      ...video(),
      canvas: { url: "http://x/canvas.mp4", bytes: 1 },
    };
    expect(() => validateManifest("test-0000000000", badUrl)).toThrow(
      /canvas\.url must be an https URL/,
    );

    const badBytes = {
      ...video(),
      canvas: { url: "https://x/canvas.mp4", bytes: 0 },
    };
    expect(() => validateManifest("test-0000000000", badBytes)).toThrow(
      /canvas\.bytes must be a positive integer/,
    );
  });
});

describe("sourceSet", () => {
  it("writes one candidate per width", () => {
    expect(
      sourceSet([
        { format: "avif", width: 640, url: "https://x/w640.avif" },
        { format: "avif", width: 1280, url: "https://x/w1280.avif" },
      ]),
    ).toBe("https://x/w640.avif 640w, https://x/w1280.avif 1280w");
  });
});
