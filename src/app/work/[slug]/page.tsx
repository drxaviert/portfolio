import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { mdxComponents } from "@/components/work/mdx-components";
import { Reader } from "@/components/work/reader";
import { getWork, listWork } from "@/lib/work";
import { WORK_BODIES } from "@/lib/work-bodies";
import { workMetadata } from "@/lib/work-metadata";

// The study needs the slug to exist at all, so there is no instant shell to
// stream in ahead of it.
export const instant = false;

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

/**
 * `/work/<slug>`: a study inside the drawer. The homepage and the panel belong
 * to the route's layout (`layout.tsx`), so this page is only the article — a
 * direct load and an in-app step both land in the same open drawer.
 */
export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getWork(slug);

  if (!meta) notFound();

  const { default: Body } = await WORK_BODIES[meta.slug]();

  return (
    <Reader meta={meta}>
      <Body components={mdxComponents} />
    </Reader>
  );
}
