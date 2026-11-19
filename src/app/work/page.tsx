import type { Metadata } from "next";
import { WorkIndex } from "@/components/work/work-index";
import { FEATURED_SLUG, listWork } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
};

/**
 * The layout a link can ask for (`?layout=grid|list`) has to be known before
 * the HTML is written, or the server-rendered grid would flip to the list after
 * hydration. Reading it is URL data, so the route blocks: a prototype option is
 * not worth a shell that renders the wrong layout first.
 */
export const instant = false;

/**
 * `/work`: the index inside the drawer. The featured study leads, as it does on
 * the homepage.
 */
export default async function WorkIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const { layout } = await searchParams;
  const works = listWork().sort(
    (a, b) =>
      Number(b.slug === FEATURED_SLUG) - Number(a.slug === FEATURED_SLUG),
  );

  return (
    <WorkIndex
      works={works}
      initialLayout={layout === "list" ? "list" : "grid"}
    />
  );
}
