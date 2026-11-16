import { notFound } from "next/navigation";
import { ExpandShell } from "@/components/work/expand-shell";
import { mdxComponents } from "@/components/work/mdx-components";
import { Reader } from "@/components/work/reader";
import { WORK_BODIES } from "@/lib/work-bodies";
import { getWork } from "@/lib/work";

/**
 * Soft navigation to /work/[slug]: the shared reader mounts over the live
 * homepage and the shell morphs it out of the featured card. A hard load of
 * the same URL renders `app/work/[slug]/page.tsx` instead.
 */
export const instant = false;

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
