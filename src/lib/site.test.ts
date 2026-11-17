import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/lib/site";

describe("resolveSiteUrl", () => {
  it("takes the explicit site URL first", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://portfolio.example",
        VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app",
        VERCEL_URL: "portfolio-git-branch.vercel.app",
      }),
    ).toBe("https://portfolio.example");
  });

  it("takes the Vercel production domain next, scheme added", () => {
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app",
        VERCEL_URL: "portfolio-abc123.vercel.app",
      }),
    ).toBe("https://portfolio.vercel.app");
  });

  it("takes the deployment's own host on a preview", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "portfolio-abc123.vercel.app" })).toBe(
      "https://portfolio-abc123.vercel.app",
    );
  });

  it("falls back to the documented dev origin", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("treats an empty variable as unset", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "",
        VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app",
      }),
    ).toBe("https://portfolio.vercel.app");
  });

  it("strips a trailing slash", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://a.example/" })).toBe(
      "https://a.example",
    );
    expect(resolveSiteUrl({ VERCEL_URL: "b.vercel.app/" })).toBe(
      "https://b.vercel.app",
    );
  });
});
