import type { Metadata } from "next";
import { SITE_NAME } from "./site";
import { getWork } from "./work";

/**
 * Title and description for one study. Shared by the hard-load page and the
 * intercepted modal page, so a soft navigation names the study too.
 *
 * openGraph and twitter are repeated because Next replaces those objects
 * wholesale; leaving them out inherits the site-level title instead.
 */
export function workMetadata(slug: string): Metadata {
  const meta = getWork(slug);

  if (!meta) return {};

  return {
    title: meta.title,
    description: meta.summary,
    openGraph: {
      type: "article",
      url: `/work/${slug}`,
      siteName: SITE_NAME,
      locale: "en_US",
      title: meta.title,
      description: meta.summary,
      // Next replaces the whole openGraph object when a child defines one, so
      // the site card from app/opengraph-image.tsx has to be named again.
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.summary,
    },
  };
}
