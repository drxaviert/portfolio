import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * `/work` used to be a permanent redirect to `/`, because the site had no
 * index. It is now the work sheet's own route, so nothing may send it away.
 * `/work` renders the sheet: see ./work/page.test.tsx.
 */
describe("work route", () => {
  it("does not redirect /work", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];

    expect(redirects.map(({ source }) => source)).not.toContain("/work");
  });
});
