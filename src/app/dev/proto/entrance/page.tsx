import { notFound } from "next/navigation";
import "@/components/home/home-entrance.css";
import { EntranceHarness } from "./entrance-harness";

/**
 * Throwaway prototype: the real home composition with a page-load entrance,
 * switched live from a floating panel. Twelve variants to compare — scale+blur,
 * rise, ring reveal, sky first, horizon clear, step cut, grain sky, horizon
 * grow, then the calm family: breath, mist lift, dawn bloom, soft focus.
 * Variants 1-8 land inside a 700ms sequence; the calm family is a deliberate
 * test of 1-2s and of the proposed calm curve.
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
