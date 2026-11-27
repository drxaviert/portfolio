/**
 * Content-addressed media ids: `<slug of the original name>-<sha256[:10]>`.
 *
 * The pipeline, the dev library and the R2 migration all need the same id for
 * the same bytes. Keeping the formula here means the migration can prove an
 * archived original still resolves to the manifest id before it re-encodes.
 */
import { createHash } from "node:crypto";
import path from "node:path";

export function slugify(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** The manifest id for an original filename and its exact bytes. */
export function mediaIdFor(name: string, bytes: Buffer): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
  const base = path.parse(name).name;
  const slug = slugify(base, 40) || "media";
  return `${slug}-${hash}`;
}
