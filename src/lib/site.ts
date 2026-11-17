/**
 * Absolute origin for metadata, robots and the sitemap. The repository carries
 * no production domain (no CNAME, vercel.json or deploy URL), so a deploy sets
 * NEXT_PUBLIC_SITE_URL; the fallback is the dev origin the README documents.
 */
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_URL = base.replace(/\/$/, "");

export const SITE_NAME = "Portfolio";

export const SITE_DESCRIPTION = "Design engineer portfolio.";
