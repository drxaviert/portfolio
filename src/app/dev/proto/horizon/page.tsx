import { notFound } from "next/navigation";
import { HorizonProto } from "./horizon-proto";
import "./horizon-proto.css";

/**
 * Throwaway prototype: the real home layout over the live horizon glow, with
 * the strength and breathe-pulse tuner floating on top — rest boost for day and
 * night, pulse presets, the A/B peak and both renderers.
 *
 * Dev-only; deep links 404 in a production build. The glow is the real
 * HorizonBackground / HorizonShader with the production dither and gradient, and
 * the design above it is the same HomeLayout / renders, so nothing here is a
 * stand-in.
 */
export const metadata = {
  title: "Prototype · horizon intensity",
  robots: { index: false, follow: false },
};

export default function HorizonIntensityPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HorizonProto />;
}
