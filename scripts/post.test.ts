import { describe, expect, it, vi } from "vitest";
import { type MediaStore, sha256Hex } from "./lib/media-store.ts";
import {
  CANVAS_MAX_HEIGHT,
  canvasTargetSize,
  HLS_MIN_DURATION,
  hlsCapFor,
  hlsRungs,
  assertOriginalServable,
  mp4CapFor,
  originalImageWidths,
  parseArgs,
  putOriginal,
  selectInbox,
  shouldUseHls,
} from "./post.ts";

describe("shouldUseHls", () => {
  it("sends a clip past the threshold to the ladder", () => {
    expect(shouldUseHls(60, { hls: false, noHls: false })).toBe(true);
    expect(
      shouldUseHls(HLS_MIN_DURATION + 0.01, { hls: false, noHls: false }),
    ).toBe(true);
  });

  it("keeps a clip at or under 20 s as one MP4", () => {
    expect(shouldUseHls(12.5, { hls: false, noHls: false })).toBe(false);
    // The boundary itself belongs to the MP4: 20 s is not "longer than 20 s".
    expect(shouldUseHls(HLS_MIN_DURATION, { hls: false, noHls: false })).toBe(
      false,
    );
  });

  it("lets the flags override the duration either way", () => {
    expect(shouldUseHls(2.5, { hls: true, noHls: false })).toBe(true);
    expect(shouldUseHls(120, { hls: false, noHls: true })).toBe(false);
  });
});

describe("selectInbox", () => {
  it("keeps every inbox file when --only is absent", () => {
    expect(selectInbox(["a.png", "b.mp4"])).toEqual(["a.png", "b.mp4"]);
  });

  it("narrows the run to the named file", () => {
    expect(selectInbox(["a.png", "b.mp4"], "b.mp4")).toEqual(["b.mp4"]);
  });

  it("rejects a path instead of a basename", () => {
    expect(() => selectInbox(["a.png"], "../a.png")).toThrow(/not a path/);
    expect(() => selectInbox(["a.png"], "sub/a.png")).toThrow(/not a path/);
  });

  it("rejects a name that is not in the inbox", () => {
    expect(() => selectInbox(["a.png"], "b.png")).toThrow(/no file named/);
  });

  it("rejects an empty name", () => {
    expect(() => selectInbox(["a.png"], "  ")).toThrow(/needs a filename/);
  });
});

describe("hlsRungs", () => {
  it("gives a 1080 source the full ladder", () => {
    expect(hlsRungs(1080).map((rung) => rung.height)).toEqual([1080, 720, 480]);
  });

  it("drops rungs taller than a 720 source and never upscales", () => {
    expect(hlsRungs(720).map((rung) => rung.height)).toEqual([720, 480]);
  });

  it("keeps one rung at the source height below 480", () => {
    const rungs = hlsRungs(360);

    expect(rungs).toHaveLength(1);
    expect(rungs[0].height).toBe(360);
    expect(Number.parseFloat(rungs[0].maxrate)).toBeGreaterThan(0);
  });

  it("floors an odd source height to an even one", () => {
    expect(hlsRungs(479)[0].height).toBe(478);
    expect(hlsRungs(721).map((rung) => rung.height)).toEqual([720, 480]);
  });
});

describe("canvasTargetSize", () => {
  it("caps a 1080p clip at 480px tall with an even width", () => {
    expect(canvasTargetSize(1920, 1080, 1080)).toEqual({
      width: 852,
      height: 480,
    });
    expect(canvasTargetSize(1920, 1080, 1080)?.height).toBe(CANVAS_MAX_HEIGHT);
  });

  it("keeps a square clip square", () => {
    expect(canvasTargetSize(1080, 1080, 1080)).toEqual({
      width: 480,
      height: 480,
    });
  });

  it("drops the 720p rung to 480", () => {
    expect(canvasTargetSize(1280, 720, 720)).toEqual({
      width: 852,
      height: 480,
    });
  });

  it("returns nothing when the main MP4 already fits", () => {
    expect(canvasTargetSize(852, 480, 480)).toBeUndefined();
    expect(canvasTargetSize(640, 360, 360)).toBeUndefined();
  });

  it("never upscales a small portrait source", () => {
    expect(canvasTargetSize(390, 844, 844)).toEqual({
      width: 220,
      height: 480,
    });
  });
});

describe("hlsCapFor", () => {
  const MB = 1024 * 1024;

  it("keeps the 150 MB cap for ordinary files", () => {
    expect(hlsCapFor("Cash-Flow.mp4")).toBe(150 * MB);
  });

  it("allows Good-Form-Reel.mp4 a larger ladder", () => {
    expect(hlsCapFor("Good-Form-Reel.mp4")).toBe(400 * MB);
  });

  it("matches the exact filename only", () => {
    expect(hlsCapFor("good-form-reel.mp4")).toBe(150 * MB);
  });
});

describe("mp4CapFor", () => {
  const MB = 1024 * 1024;

  it("keeps the 10 MB cap for ordinary files", () => {
    expect(mp4CapFor("Cash-Flow.mp4")).toBe(10 * MB);
  });

  it("allows the three curated high-motion clips 15 MB", () => {
    for (const name of [
      "NIOD_CAIL_a01_DT_Front_1_0064.mp4",
      "NIOD_Cell04_Anim_v03_FINAL.mp4",
      "xylo-Branding-Good-Form.mp4",
    ]) {
      expect(mp4CapFor(name)).toBe(15 * MB);
    }
  });
});

describe("--original", () => {
  it("parses the flag and refuses re-encode flags beside it", () => {
    expect(parseArgs(["--original"]).original).toBe(true);
    expect(parseArgs([]).original).toBe(false);
    expect(() => parseArgs(["--original", "--hls"])).toThrow(/--original/);
    expect(() => parseArgs(["--original", "--webm"])).toThrow(/--original/);
  });

  it("encodes only the standard widths below the source", () => {
    expect(originalImageWidths(2400)).toEqual([640, 1280, 1920]);
    expect(originalImageWidths(2560)).toEqual([640, 1280, 1920]);
    expect(originalImageWidths(3000)).toEqual([640, 1280, 1920, 2560]);
    expect(originalImageWidths(600)).toEqual([]);
  });

  it("serves only formats a browser plays as is", () => {
    expect(() => assertOriginalServable("video", "mp4")).not.toThrow();
    expect(() => assertOriginalServable("video", "MP4")).not.toThrow();
    expect(() => assertOriginalServable("video", "mov")).toThrow(/\.mov/);
    expect(() => assertOriginalServable("image", "webp")).not.toThrow();
    expect(() => assertOriginalServable("image", "avif")).not.toThrow();
    expect(() => assertOriginalServable("image", "png")).toThrow(/\.png/);
  });
});

describe("putOriginal", () => {
  const body = Buffer.from("original bytes");
  const digest = sha256Hex(body);

  function fakeStore(
    kind: MediaStore["kind"],
    stored: string | null,
  ): { store: MediaStore; put: ReturnType<typeof vi.fn> } {
    const put = vi.fn(async ({ key }: { key: string }) => ({
      url: `https://media.test/${key}`,
      skipped: false,
    }));
    return {
      put,
      store: {
        kind,
        urlFor: (key) => `https://media.test/${key}`,
        head: async () => true,
        storedSha256: async () => stored,
        put,
      },
    };
  }

  it("sends the digest and passes when the store holds the same bytes", async () => {
    const { store, put } = fakeStore("r2", digest);
    const result = await putOriginal(store, "media/a/video.mp4", body);
    expect(put.mock.calls[0][0]).toMatchObject({ sha256: digest, body });
    expect(result).toEqual({
      url: "https://media.test/media/a/video.mp4",
      bytes: body.byteLength,
      sha256: digest,
    });
  });

  it("fails on a mismatched or missing stored checksum", async () => {
    await expect(
      putOriginal(fakeStore("r2", "0".repeat(64)).store, "k", body),
    ).rejects.toThrow(/failed verification/);
    await expect(
      putOriginal(fakeStore("r2", null).store, "k", body),
    ).rejects.toThrow(/\(none\)/);
  });

  it("skips the comparison on a dry run", async () => {
    const { store } = fakeStore("dry-run", null);
    await expect(putOriginal(store, "k", body)).resolves.toMatchObject({
      sha256: digest,
    });
  });
});
