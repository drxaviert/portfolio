import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { readR2PublicBaseUrl } from "./scripts/lib/r2-env.ts";

/**
 * The R2 public host is a constant so production never needs `.env.r2` or an
 * R2 env var. `R2_PUBLIC_BASE_URL` may still add an override host (for a custom
 * domain). The Blob host is gone: every rendered manifest now points at R2.
 */
const R2_PUBLIC_HOST = "pub-45d68b9ea40441aeb7424d6b1a80a7c7.r2.dev";

function mediaRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const patterns: NonNullable<
    NonNullable<NextConfig["images"]>["remotePatterns"]
  > = [
    {
      protocol: "https",
      hostname: R2_PUBLIC_HOST,
    },
  ];

  const base = readR2PublicBaseUrl(process.cwd());
  if (base) {
    try {
      const url = new URL(base);
      if (url.protocol === "https:" && url.hostname !== R2_PUBLIC_HOST) {
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
    remotePatterns: [
      ...mediaRemotePatterns(),
      {
        // The music card's sleeve artwork is the video's own thumbnail.
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
      {
        // The daily painting's IIIF images, served at AIC's cached widths.
        protocol: "https",
        hostname: "www.artic.edu",
        pathname: "/iiif/2/**",
      },
    ],
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
