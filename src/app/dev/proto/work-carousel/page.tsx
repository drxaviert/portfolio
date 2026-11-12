import { notFound } from "next/navigation";
import "@/components/home/ring-hover.css";
import { WorkCarousel } from "./work-carousel";

/**
 * Throwaway prototype: the middle row of /dev/prototype as a Stripe-style
 * squeezy carousel — one featured slot, medium slots and sliver hints, with
 * the Ring hover language from the card-hover round.
 *
 * Dev-only; deep links 404 in a production build. Shares the home nav, cards
 * and ring styles from src/components/home with /.
 */
export const metadata = {
  title: "Prototype · work carousel",
  robots: { index: false, follow: false },
};

export default function WorkCarouselPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <WorkCarousel />;
}
