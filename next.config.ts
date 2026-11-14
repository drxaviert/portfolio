import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  // Lets Dat test dev servers from a laptop on the LAN (Next 16 blocks
  // cross-origin dev requests, so the page never hydrates without this).
  allowedDevOrigins: ["192.168.2.33", "192.168.2.28"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
