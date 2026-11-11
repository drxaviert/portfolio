import { notFound } from "next/navigation";
import { CardHoverHarness } from "./harness";

/**
 * Throwaway prototype: three hover languages for the home-page cards, behind a
 * live picker. Dev-only; deep links 404 in a production build.
 *
 * Not part of the /dev/prototype work: this route only imports from it.
 */
export const metadata = {
  title: "Prototype · card hover",
  robots: { index: false, follow: false },
};

export default function CardHoverPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CardHoverHarness />;
}
