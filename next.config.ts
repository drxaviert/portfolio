import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Media lives in a public Vercel Blob store. The variants are encoded
    // ahead of time by `pnpm post` and drawn with `<picture>`, so no request
    // goes through Next's optimiser; this pattern is the allow-list for any
    // future next/image that needs to point at the same store.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
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
