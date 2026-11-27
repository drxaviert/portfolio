import type { CSSProperties, ReactNode } from "react";
import type { DailyArt } from "@/lib/daily-art";
import "./painting-frame.css";

/**
 * The painting's frame. Outer box = the artwork's aspect, so the frame itself
 * never stretches or crops the composition:
 *
 *   height = min(100cqh, frame-share / aspect)
 *   width  = height × aspect
 *
 * `cqh`/`cqw` come from the card (or the lab stage), which is a size container.
 * That keeps the sizing in CSS: a panorama is capped by the share of the
 * available width, a portrait is capped by the card height, and neither needs
 * a measure pass or a client re-render.
 *
 * The material follows the phase, not the artwork: ornate gilt on the light
 * surface and the same ornate gilt with the walnut palette at night. The
 * frame structure is shared; globals.css supplies only the phase colours.
 * Every painting uses the same frame.
 */

type PaintingFrameProps = {
  art: Pick<DailyArt, "width" | "height">;
  children: ReactNode;
  className?: string;
};

export function PaintingFrame({
  art,
  children,
  className = "",
}: PaintingFrameProps) {
  const aspect =
    Number.isFinite(art.width) &&
    Number.isFinite(art.height) &&
    art.width > 0 &&
    art.height > 0
      ? art.width / art.height
      : 4 / 3;

  return (
    <div
      className={`painting-frame ${className}`.trim()}
      style={{ "--art-ratio": aspect } as CSSProperties}
    >
      <div className="painting-frame-mount">
        <div className="painting-frame-window">{children}</div>
      </div>
    </div>
  );
}
