import { notFound } from "next/navigation";
import { HomeLayout } from "@/components/home/home-layout";
import { GlowTuner } from "./glow-tuner";
import { PhasePicker } from "./phase-picker";

/**
 * Dev-only view of the home layout with the phase picker and glow tuner. It
 * renders the same src/components/home composition as /, so the two routes
 * stay identical apart from the dev tools below.
 */
export const metadata = {
  title: "Prototype · home",
  robots: { index: false, follow: false },
};

export default function PrototypePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <>
      <HomeLayout />
      <PhasePicker />
      <GlowTuner />
    </>
  );
}
