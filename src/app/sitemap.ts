import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getWork, listWork } from "@/lib/work";

export default function sitemap(): MetadataRoute.Sitemap {
  // The live piece follows the study's sunset switch, like `/work/<slug>`.
  const live = getWork("human-contact");

  return [
    { url: new URL("/", SITE_URL).toString() },
    ...listWork().map(({ slug }) => ({
      url: new URL(`/work/${slug}`, SITE_URL).toString(),
    })),
    ...(live
      ? [{ url: new URL("/live/human-contact", SITE_URL).toString() }]
      : []),
  ];
}
