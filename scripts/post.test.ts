import { describe, expect, it } from "vitest";
import { HLS_MIN_DURATION, hlsRungs, shouldUseHls } from "./post.ts";

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
