import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import { listWork } from "@/lib/work";
import sitemap from "./sitemap";

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists the homepage and the visible studies", () => {
    expect(urls).toEqual([
      new URL("/", SITE_URL).toString(),
      ...listWork().map((work) =>
        new URL(`/work/${work.slug}`, SITE_URL).toString(),
      ),
    ]);
    expect(urls).toContain(
      new URL("/work/motion-and-stills", SITE_URL).toString(),
    );
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
