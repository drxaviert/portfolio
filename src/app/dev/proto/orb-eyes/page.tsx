import { notFound } from "next/navigation";
import "@/components/home/ring-hover.css";
import { OrbEyesProto } from "./orb-eyes";

/**
 * Throwaway prototype: the nav orb's eyes follow the cursor.
 *
 * Dev-only; deep links 404 in a production build. The page shares the shipped
 * frame, nav parts and type tokens with `/`, and adds a 4× head plus a tuning
 * panel. Nothing in src/components/home is affected.
 */
export const metadata = {
  title: "Prototype · orb gaze",
  robots: { index: false, follow: false },
};

export default function OrbEyesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <OrbEyesProto />;
}
