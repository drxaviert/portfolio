import { describe, expect, it } from "vitest";
import { formatTime, thumbnailUrl, watchUrl } from "./vinyl-track";

describe("vinyl track", () => {
  it("formats elapsed time as mm:ss with tabular-friendly padding", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(8)).toBe("0:08");
    expect(formatTime(68)).toBe("1:08");
    expect(formatTime(228)).toBe("3:48");
    expect(formatTime(249)).toBe("4:09");
  });

  it("keeps an hours field only when a track needs it", () => {
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("treats missing or negative time as zero", () => {
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("builds the thumbnail and watch URLs from the video id", () => {
    expect(thumbnailUrl("abc123")).toBe(
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    );
    expect(watchUrl("abc123")).toBe("https://www.youtube.com/watch?v=abc123");
  });
});
