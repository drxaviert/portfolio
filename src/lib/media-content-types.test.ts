import { describe, expect, it } from "vitest";
import { contentTypeFor } from "./media-content-types";

describe("contentTypeFor", () => {
  it("maps every extension the pipeline writes", () => {
    expect(contentTypeFor("media/id/hls/master.m3u8")).toBe(
      "application/vnd.apple.mpegurl",
    );
    expect(contentTypeFor("media/id/hls/v0/segment_0.ts")).toBe("video/mp2t");
    expect(contentTypeFor("media/id/hls/v0/segment_1.m4s")).toBe(
      "video/iso.segment",
    );
    expect(contentTypeFor("media/id/video.mp4")).toBe("video/mp4");
    expect(contentTypeFor("media/id/video.webm")).toBe("video/webm");
    expect(contentTypeFor("media/id/poster.avif")).toBe("image/avif");
    expect(contentTypeFor("media/id/w640.webp")).toBe("image/webp");
    expect(contentTypeFor("media/id/poster.jpg")).toBe("image/jpeg");
  });

  it("is case-insensitive and ignores a query string", () => {
    expect(contentTypeFor("media/id/POSTER.AVIF?version=2")).toBe("image/avif");
  });

  it("falls back to octet-stream for an unknown extension", () => {
    expect(contentTypeFor("media/id/notes")).toBe("application/octet-stream");
    expect(contentTypeFor("media/id/archive.zip")).toBe(
      "application/octet-stream",
    );
  });
});
