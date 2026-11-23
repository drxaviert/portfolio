import { notFound } from "next/navigation";
import { HumanContactLightingDev } from "./lighting-dev";
import "./lighting.css";

/**
 * Dev-only lighting lab. The shipped study is `/work/human-contact`; this route
 * keeps a production-gated full-screen entry with the three lighting presets
 * selectable from the corner or `?light=1|2|3`.
 */
export const metadata = {
  title: "Human Contact clone · lighting lab",
  robots: { index: false, follow: false },
};

export default function HumanContactPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HumanContactLightingDev />;
}
