import { notFound } from "next/navigation";
import "@/components/human-contact/human-contact.css";
import { HumanContactExperience } from "@/components/human-contact/human-contact-experience";

/**
 * Dev-only rebuild of HUMANCONTACT's home grid: seven procedural props on a
 * staggered field, with a hover interaction the original never had. The
 * toggle compares three spring treatments (plain scale, lift toward camera,
 * neighbours making room); `?variant=a|b|c` selects one on load.
 *
 * Dev-only; deep links 404 in a production build.
 */
export const metadata = {
  title: "Human Contact clone · hover study",
  robots: { index: false, follow: false },
};

export default function HumanContactPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HumanContactExperience />;
}
