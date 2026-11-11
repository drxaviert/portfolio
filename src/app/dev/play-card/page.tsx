import { notFound } from "next/navigation";
import { PlayLab } from "@/components/play/play-lab";

/**
 * Dev-only lab for the Play card. Pins a phase, exposes the fan's live
 * settings and prints the numbers to copy back into the defaults.
 * Deep links into this route 404 in a production build.
 */
export const metadata = {
  title: "Play card · fibre fan",
  robots: { index: false, follow: false },
};

export default function PlayCardLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <PlayLab />;
}
