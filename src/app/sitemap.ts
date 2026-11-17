import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listWork } from "@/lib/work";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", SITE_URL).toString() },
    ...listWork().map(({ slug }) => ({
      url: new URL(`/work/${slug}`, SITE_URL).toString(),
    })),
  ];
}
