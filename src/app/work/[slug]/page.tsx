import type { MDXProps } from "mdx/types";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { mdxComponents } from "@/components/work/mdx-components";
import { Reader } from "@/components/work/reader";
import { getWork, listWork } from "@/lib/work";

type WorkBody = { default: ComponentType<MDXProps> };

// The reader is the whole page and it needs the slug to exist at all, so there
// is no instant shell to stream in ahead of it.
export const instant = false;

/**
 * One importer per study: every slug in `listWork()` needs an entry. Picked by
 * slug after `getWork` validates it, so the route renders from frontmatter
 * until the body is actually shown.
 */
const BODIES: Record<string, () => Promise<WorkBody>> = {
  "systems-in-motion": () =>
    import("../../../../content/work/systems-in-motion.mdx"),
  "title-sequence": () => import("../../../../content/work/title-sequence.mdx"),
  "type-in-motion": () => import("../../../../content/work/type-in-motion.mdx"),
};

export function generateStaticParams() {
  return listWork().map(({ slug }) => ({ slug }));
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getWork(slug);
  const loadBody = BODIES[slug];

  if (!meta || !loadBody) notFound();

  const { default: Body } = await loadBody();

  return (
    <Reader meta={meta} mode="page">
      <Body components={mdxComponents} />
    </Reader>
  );
}
