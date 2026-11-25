import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import sitemap from "./sitemap";

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists the homepage and the visible studies", () => {
    expect(urls).toEqual([
      new URL("/", SITE_URL).toString(),
      new URL("/work/systems-in-motion", SITE_URL).toString(),
      new URL("/work/title-sequence", SITE_URL).toString(),
      new URL("/work/type-in-motion", SITE_URL).toString(),
      new URL("/work/motion-and-stills", SITE_URL).toString(),
    ]);
  });

  it("leaves the hidden study and its live route out", () => {
    expect(urls).not.toContain(
      new URL("/work/human-contact", SITE_URL).toString(),
    );
    expect(urls).not.toContain(
      new URL("/live/human-contact", SITE_URL).toString(),
    );
  });
});
