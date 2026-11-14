import { notFound } from "next/navigation";
import "@/components/home/home-entrance.css";
import { EntranceHarness } from "./entrance-harness";

/**
 * Throwaway prototype: the real home composition with a page-load entrance,
 * switched live from a floating panel. Four variants to compare — scale+blur,
 * rise, ring reveal, sky first — all inside a 700ms sequence on the design
 * system's entrance curve.
 *
 * Dev-only; deep links 404 in a production build. The layout it renders is
 * src/components/home/home-layout, so anything decided here moves over cleanly.
 */
export const metadata = {
  title: "Prototype · home entrance",
  robots: { index: false, follow: false },
};

export default function EntrancePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <EntranceHarness />;
}
