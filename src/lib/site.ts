/**
 * Absolute origin for metadata, robots and the sitemap.
 *
 * `NEXT_PUBLIC_SITE_URL` is the explicit override. On Vercel the system already
 * knows the origin: `VERCEL_PROJECT_PRODUCTION_URL` is the project's production
 * domain and is set in every environment, and `VERCEL_URL` is this deployment
 * (a preview's own host). Only a local run falls back to the dev origin the
 * README documents.
 */
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL;

  if (explicit) return stripSlash(explicit);

  const production = env.VERCEL_PROJECT_PRODUCTION_URL;

  if (production) return stripSlash(`https://${production}`);

  const deployment = env.VERCEL_URL;

  if (deployment) return stripSlash(`https://${deployment}`);

  return "http://localhost:3000";
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "Portfolio";

export const SITE_DESCRIPTION = "Design engineer portfolio.";
