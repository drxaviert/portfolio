import { describe, expect, it } from "vitest";
import {
  NOW_PLAYING_TRACK,
  formatDuration,
  formatTime,
  thumbnailUrl,
  watchUrl,
} from "./now-playing-track";

describe("now-playing track", () => {
  it("keeps the design copy and the embeddable placeholder video", () => {
    expect(NOW_PLAYING_TRACK.title).toBe("Get Lucky");
    expect(NOW_PLAYING_TRACK.artist).toBe("Daft Punk");
    expect(NOW_PLAYING_TRACK.videoId).toBe("M7lc1UVf-VE");
    expect(NOW_PLAYING_TRACK.durationLabel).toBe("4:09");
  });

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

  it("rounds the total length so a 248.9s video still reads 4:09", () => {
    expect(formatDuration(248.9)).toBe("4:09");
    expect(formatDuration(249.6)).toBe("4:10");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("treats missing or negative time as zero", () => {
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("builds maxres and hq thumbnail URLs plus the watch URL", () => {
    expect(thumbnailUrl("abc123")).toBe(
      "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    );
    expect(thumbnailUrl("abc123", "hqdefault")).toBe(
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    );
    expect(watchUrl("abc123")).toBe("https://www.youtube.com/watch?v=abc123");
  });
});
