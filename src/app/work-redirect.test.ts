import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("work route redirects", () => {
  it("sends /work to the homepage permanently, and only /work", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual([
      { source: "/work", destination: "/", permanent: true },
    ]);
    // `/work/<slug>` is the study reader: no pattern may capture it.
    expect(redirects?.[0]?.source).not.toMatch(/[:*(]/);
  });
});
