import { notFound } from "next/navigation";
import { HumanContactFull } from "@/components/human-contact/human-contact-full";

/**
 * Dev-only route for the live scene. The shipped study is
 * `/work/human-contact`; this page keeps a production-gated full-screen entry
 * for checking the same neutral Film look.
 */
export const metadata = {
  title: "Human Contact clone · dev",
  robots: { index: false, follow: false },
};

export default function HumanContactPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HumanContactFull />;
}
