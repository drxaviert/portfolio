/**
 * Flat `key: value` frontmatter, split at the first colon so a value may
 * contain one. The content files are ours, so this stays deliberately small.
 * A saved-with-BOM file is still frontmatter: the editor's mark is not content.
 *
 * Shared by the case studies (`work.ts`) and the play feed (`posts.ts`), which
 * write different keys through the same shape.
 */
export function parseFrontmatter(source: string): Record<string, string> {
  const block = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!block) return {};

  const fields: Record<string, string> = {};

  for (const line of block[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    fields[key] = line.slice(colon + 1).trim();
  }

  return fields;
}
