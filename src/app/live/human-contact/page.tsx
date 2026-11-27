import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HumanContactFull } from "@/components/human-contact/human-contact-full";
import { SITE_NAME } from "@/lib/site";
import { getWork } from "@/lib/work";

const DESCRIPTION =
  "A live, full-screen recreation of HUMANCONTACT's floating-object homepage. Original design: HUMANCONTACT INC. (humancontact.com); hover interaction added by Dat.";

// The sunset check is request-time; there is no instant shell to stream ahead
// of it, the same reason `/work/<slug>` blocks.
export const instant = false;

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
 *
 * It follows the study's sunset switch: while `human-contact` is hidden the
 * route 404s. `connection()` keeps the route out of the build's static page
 * list, so the 404 is decided per request instead of being prerendered.
 */
export default async function LiveHumanContactPage() {
  await connection();

  if (!getWork("human-contact")) notFound();

  return <HumanContactFull />;
}
