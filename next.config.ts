import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  // Dev pages are reviewed from the LAN as well as localhost. Next 16 blocks
  // its dev-only endpoints (/_next/hmr and friends) for origins other than
  // localhost, which left the LAN URL serving HTML that never hydrated.
  allowedDevOrigins: ["192.168.2.33"],
};

const withMDX = createMDX({
  options: {
    // Plugin names must stay strings for Turbopack: it cannot receive functions.
    remarkPlugins: ["remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
