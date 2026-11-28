import type { Metadata } from "next";
import { WorkIndex } from "@/components/work/work-index";
import { PINNED_SLUG } from "@/components/work/work-filter";
import { FEATURED_SLUG, listWork } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
};

/** Motion & Stills leads, then the featured study, as on the homepage. */
function rank(slug: string): number {
  if (slug === PINNED_SLUG) return 0;
  if (slug === FEATURED_SLUG) return 1;
  return 2;
}

/** `/work`: the index inside the drawer. */
export default function WorkIndexPage() {
  const works = listWork().sort((a, b) => rank(a.slug) - rank(b.slug));

  return <WorkIndex works={works} />;
}
