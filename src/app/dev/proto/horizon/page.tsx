import { notFound } from "next/navigation";
import { HorizonProto } from "./horizon-proto";
import "./horizon-proto.css";

/**
 * Throwaway prototype: the home horizon glow with the breathe-locked intensity
 * pulse behind a live picker — amplitude presets, the night damping, the A/B
 * peak and both renderers side by side in the same session.
 *
 * Dev-only; deep links 404 in a production build. The background is the real
 * HorizonBackground / HorizonShader full-screen, so the colours, blur, phase
 * crossfade and dither are the production ones.
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
