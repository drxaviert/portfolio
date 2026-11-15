import { notFound } from "next/navigation";
import { mdxComponents } from "@/components/work/mdx-components";
import { PageReaderShell } from "@/components/work/page-reader-shell";
import { Reader } from "@/components/work/reader";
import { WORK_BODIES } from "@/lib/work-bodies";
import { getWork, listWork } from "@/lib/work";

// The reader is the whole page and it needs the slug to exist at all, so there
// is no instant shell to stream in ahead of it.
export const instant = false;

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

  if (!meta) notFound();

  const { default: Body } = await WORK_BODIES[meta.slug]();

  return (
    <PageReaderShell>
      <Reader meta={meta} mode="page">
        <Body components={mdxComponents} />
      </Reader>
    </PageReaderShell>
  );
}
