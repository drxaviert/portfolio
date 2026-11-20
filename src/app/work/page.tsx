import type { Metadata } from "next";
import { WorkIndex } from "@/components/work/work-index";
import { FEATURED_SLUG, listWork } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
};

/**
 * `/work`: the index inside the drawer. The featured study leads, as it does on
 * the homepage.
 *
 * The visitor's grid / list choice is not URL data: it lives in localStorage and
 * the work layout's inline script applies it before paint, so this route stays
 * static and the server always renders both layouts.
 */
export default function WorkIndexPage() {
  const works = listWork().sort(
    (a, b) =>
      Number(b.slug === FEATURED_SLUG) - Number(a.slug === FEATURED_SLUG),
  );

  return <WorkIndex works={works} />;
}
