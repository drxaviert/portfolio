"use client";

import dynamic from "next/dynamic";
import type { FiberFanSettings } from "@/components/play/fiber-fan-settings";

const FiberFan = dynamic(
  () => import("@/components/play/fiber-fan").then((mod) => mod.FiberFan),
  {
    ssr: false,
    loading: () => null,
  },
);

export type PlayCardProps = {
  settings?: Partial<FiberFanSettings>;
  className?: string;
};

/**
 * The Play card: a fibre-optic fan on a two-tone gradient, linking to /play.
 * three.js lives in the dynamic chunk, so the card costs nothing until it is
 * on screen.
 */
export function PlayCard({ settings, className }: PlayCardProps) {
  return (
    <a
      href="/play"
      aria-label="Play: interactive art"
      className={[
        "relative block h-[276px] w-[849px] max-w-full overflow-hidden rounded-lg shadow-card outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className ?? "",
      ]
        .join(" ")
        .trim()}
      style={{
        background:
          "linear-gradient(180deg, var(--play-bg-top) 0%, var(--play-bg-mid) 58%, var(--play-bg-mid) 74%, var(--play-base, var(--play-bg-bottom)) 100%)",
      }}
    >
      <FiberFan {...settings} className="absolute inset-0" />
    </a>
  );
}
