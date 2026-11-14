import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
};

const withMDX = createMDX({
  options: {
    // Plugin names must stay strings for Turbopack: it cannot receive functions.
    remarkPlugins: ["remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
