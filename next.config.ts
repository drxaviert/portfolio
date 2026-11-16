import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  // Lets Dat test dev servers from a laptop on the LAN (Next 16 blocks
  // cross-origin dev requests, so the page never hydrates without this).
  allowedDevOrigins: ["192.168.2.33", "192.168.2.28"],
  async redirects() {
    // `/work` is a list route the site never had: the work lives on `/`. Exact
    // match only — `/work/<slug>` is the study reader and must stay reachable.
    return [{ source: "/work", destination: "/", permanent: true }];
  },
};

const withMDX = createMDX({
  options: {
    // Plugin names must stay strings for Turbopack: it cannot receive functions.
    remarkPlugins: ["remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
