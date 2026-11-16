import { notFound } from "next/navigation";
import { HomeScreen } from "@/components/home/home-screen";
import { ExpandShell } from "@/components/work/expand-shell";
import { mdxComponents } from "@/components/work/mdx-components";
import { Reader } from "@/components/work/reader";
import { RouteStudy } from "@/components/work/route-study";
import { WORK_BODIES } from "@/lib/work-bodies";
import { getWork, listWork } from "@/lib/work";

// The reader needs the slug to exist at all, so there is no instant shell to
// stream in ahead of it.
export const instant = false;

export function generateStaticParams() {
  return listWork().map(({ slug }) => ({ slug }));
}

/**
 * A direct load of a study renders the same thing a soft navigation does: the
 * homepage underneath, the overlay reader open on top, resting (no morph). The
 * reader content is server-rendered either way, so the study is still the HTML
 * a crawler or a visitor without JS receives.
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
    <>
      <HomeScreen />
      <RouteStudy slug={meta.slug}>
        <ExpandShell slug={meta.slug} resting>
          <Reader meta={meta}>
            <Body components={mdxComponents} />
          </Reader>
        </ExpandShell>
      </RouteStudy>
    </>
  );
}
