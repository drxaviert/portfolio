import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { readR2PublicBaseUrl } from "./scripts/lib/r2-env.ts";

/**
 * The R2 public host is read from `R2_PUBLIC_BASE_URL` or `.env.r2`; it is
 * absent until the owner creates the bucket, so the list stays valid either
 * way. The Blob host stays until the migration is complete.
 */
function mediaRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const patterns: NonNullable<
    NonNullable<NextConfig["images"]>["remotePatterns"]
  > = [
    {
      protocol: "https",
      hostname: "**.public.blob.vercel-storage.com",
    },
  ];

  const base = readR2PublicBaseUrl(process.cwd());
  if (base) {
    try {
      const url = new URL(base);
      if (url.protocol === "https:") {
        patterns.push({
          protocol: "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
        });
      }
    } catch {
      // A malformed value fails the pipeline with a named key; the build keeps
      // its current allow-list rather than crashing on a half-filled env.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Media is encoded ahead of time by `pnpm post` and drawn with `<picture>`,
    // so no request goes through Next's optimiser; this pattern is the
    // allow-list for any future next/image that points at the same store.
    remotePatterns: mediaRemotePatterns(),
  },
  // Lets Dat test dev servers from a laptop on the LAN (Next 16 blocks
  // cross-origin dev requests, so the page never hydrates without this).
  allowedDevOrigins: ["192.168.2.33", "192.168.2.28"],
};

const withMDX = createMDX({
  options: {
    // Plugin names must stay strings for Turbopack: it cannot receive functions.
    remarkPlugins: ["remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
