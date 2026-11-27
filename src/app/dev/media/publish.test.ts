import { describe, expect, it } from "vitest";
import { parseStatus } from "./publish";

describe("parseStatus", () => {
  it("collects untracked and modified manifests", () => {
    const output = [
      "?? content/media/still-1234567890.json",
      " M content/media/loop-0987654321.json",
      "M  content/media/third-1111111111.json",
    ].join("\n");

    expect(parseStatus(output)).toEqual({
      media: [
        "content/media/still-1234567890.json",
        "content/media/loop-0987654321.json",
        "content/media/third-1111111111.json",
      ],
      other: [],
    });
  });

  it("treats anything outside content/media as a blocker", () => {
    const output = [
      "?? content/media/still-1234567890.json",
      " M src/app/page.tsx",
      "?? content/media/notes.txt",
      " M content/work/ai-agents-google.mdx",
    ].join("\n");

    const { media, other } = parseStatus(output);

    expect(media).toEqual(["content/media/still-1234567890.json"]);
    expect(other).toEqual([
      "src/app/page.tsx",
      "content/media/notes.txt",
      "content/work/ai-agents-google.mdx",
    ]);
  });

  it("reads the new path of a rename", () => {
    const output =
      "R  content/media/old-1234567890.json -> content/media/new-1234567890.json";

    expect(parseStatus(output).media).toEqual([
      "content/media/new-1234567890.json",
    ]);
  });

  it("ignores blank lines", () => {
    expect(parseStatus("\n\n")).toEqual({ media: [], other: [] });
  });
});
