import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExpandShell } from "@/components/work/expand-shell";
import { mdxComponents } from "@/components/work/mdx-components";
import { Reader } from "@/components/work/reader";
import { WORK_BODIES } from "@/lib/work-bodies";
import { getWork, listWork } from "@/lib/work";
import { workMetadata } from "@/lib/work-metadata";

/**
 * Soft navigation to /work/[slug]: the shared reader mounts over the live
 * homepage and the shell morphs it out of the featured card. A hard load of
 * the same URL renders `app/work/[slug]/page.tsx` instead.
 */
export const instant = false;

/**
 * The studies are a fixed set, so the intercepted page can be generated for
 * each slug just like the direct route. Without this it is a dynamic fallback:
 * the link's prefetch only carries the shell and the first click has to fetch
 * the article's RSC payload before the drawer can mount, which puts a server
 * round trip in front of the morph.
 */
export function generateStaticParams() {
  return listWork().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return workMetadata(slug);
}

export default async function InterceptedWorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getWork(slug);

  if (!meta) notFound();

  const { default: Body } = await WORK_BODIES[meta.slug]();

  return (
    <ExpandShell slug={meta.slug}>
      <Reader meta={meta}>
        <Body components={mdxComponents} />
      </Reader>
    </ExpandShell>
  );
}
