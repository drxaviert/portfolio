import { describe, expect, it } from "vitest";
import { safeUploadName } from "./upload-name";

describe("safeUploadName", () => {
  it("keeps a plain name and lowercases the extension", () => {
    expect(safeUploadName("Loop%20test.MP4")).toEqual({
      name: "Loop-test.mp4",
      kind: "video",
    });
    expect(safeUploadName("still.png")).toEqual({
      name: "still.png",
      kind: "image",
    });
  });

  it("strips diacritics and spaces rather than dropping the name", () => {
    expect(safeUploadName(encodeURIComponent("Café à Paris.JPG"))).toEqual({
      name: "Cafe-a-Paris.jpg",
      kind: "image",
    });
  });

  it("rejects a path instead of a filename", () => {
    expect(() => safeUploadName("..%2Fsecret.png")).toThrow(/plain filename/);
    expect(() => safeUploadName("sub%5Cstill.png")).toThrow(/plain filename/);
  });

  it("rejects an extension the pipeline cannot encode", () => {
    expect(() => safeUploadName("notes.txt")).toThrow(/Only images and videos/);
    expect(() => safeUploadName("clip.mp3")).toThrow(/Only images and videos/);
    expect(() => safeUploadName("no-extension")).toThrow(
      /Only images and videos/,
    );
  });

  it("rejects hidden files and empty names", () => {
    expect(() => safeUploadName(".env.local")).toThrow(/Hidden files/);
    expect(() => safeUploadName("   ")).toThrow(/no name/);
  });

  it("caps a very long stem", () => {
    const { name } = safeUploadName(`${"a".repeat(200)}.png`);
    expect(name.length).toBeLessThanOrEqual(84);
    expect(name.endsWith(".png")).toBe(true);
  });
});
