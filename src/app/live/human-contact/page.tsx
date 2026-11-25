import type { Metadata } from "next";
import { HumanContactFull } from "@/components/human-contact/human-contact-full";
import { RouteTransition } from "@/components/route-transition/route-transition";
import { SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "A live, full-screen recreation of HUMANCONTACT's floating-object homepage. Original design: HUMANCONTACT INC. (humancontact.com); hover interaction added by Dat.";

export const metadata: Metadata = {
  title: "Human Contact — live",
  description: DESCRIPTION,
  openGraph: {
    type: "article",
    url: "/live/human-contact",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Human Contact — live",
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Human Contact — live",
    description: DESCRIPTION,
  },
};

/**
 * The standalone piece: no `/work` layout, drawer or homepage underneath. The
 * root nav and mobile gate also step aside for `/live`, so the recreation owns
 * the viewport and its touch interaction is reachable on a phone.
 */
export default function LiveHumanContactPage() {
  return (
    <RouteTransition>
      <HumanContactFull />
    </RouteTransition>
  );
}
