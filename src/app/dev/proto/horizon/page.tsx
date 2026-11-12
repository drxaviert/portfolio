import { notFound } from "next/navigation";
import { HorizonProto } from "./horizon-proto";
import "./horizon-proto.css";

/**
 * Throwaway prototype: the home horizon glow with three ambient motion
 * variants (drift, breathe, both) behind a live picker.
 *
 * Dev-only; deep links 404 in a production build. The background is the real
 * HorizonBackground full-screen, so the colours, blur and phase crossfade are
 * the production ones.
 */
export const metadata = {
  title: "Prototype · horizon ambient",
  robots: { index: false, follow: false },
};

export default function HorizonAmbientPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HorizonProto />;
}
