import type { Metadata } from "next";
import { HomeScreen } from "@/components/home/home-screen";
import { WorkSheet } from "@/components/work/work-sheet";
import { FEATURED_SLUG, listWork } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
};

/**
 * `/work` as its own document, and as the page a soft navigation lands on: the
 * homepage underneath and the sheet over it, open (already at rest on a direct
 * load, rising when the nav brought it here).
 *
 * The sheet lives on this page rather than in the intercepted slot because the
 * page survives a study opening over it: `/work` -> `/work/[slug]` swaps the
 * modal slot's page, while the page below stays mounted, so the sheet keeps its
 * scroll position and closing the reader lands back exactly where it was.
 */
export default function WorkIndexPage() {
  // The featured study leads, as it does on the homepage.
  const works = listWork().sort(
    (a, b) =>
      Number(b.slug === FEATURED_SLUG) - Number(a.slug === FEATURED_SLUG),
  );

  return (
    <>
      <HomeScreen />
      <WorkSheet works={works} />
    </>
  );
}
