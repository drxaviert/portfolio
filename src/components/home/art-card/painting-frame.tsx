import type { CSSProperties, ReactNode } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { frameStyleFor } from "./frame-style";
import type { FrameEra, FrameMount } from "./frame-style";
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
 * The frame face is CSS layers — bevels, grain and inset shadows — not an
 * image, so it stays crisp from the 160px card to the dialog. Era comes from
 * the artwork's date (and, for tall East Asian works, the scroll mount).
 */

type PaintingFrameProps = {
  art: Pick<DailyArt, "dateStart" | "placeOfOrigin" | "width" | "height">;
  children: ReactNode;
  /** Card mode for the day view, full for the dialog stage. */
  variant?: "card" | "full";
  /** Lab and dev overrides: force an era to compare the frame tokens. */
  era?: FrameEra;
  /** Dev override: pair a forced era with a mount that suits it. */
  mount?: FrameMount;
  className?: string;
};

export function PaintingFrame({
  art,
  children,
  variant = "card",
  era,
  mount,
  className = "",
}: PaintingFrameProps) {
  const style = frameStyleFor(art);
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
      data-era={era ?? style.era}
      data-mount={mount ?? style.mount}
      data-variant={variant}
      style={{ "--art-ratio": aspect } as CSSProperties}
    >
      <span className="painting-frame-rod" data-edge="top" aria-hidden="true" />
      <div className="painting-frame-mount">
        <div className="painting-frame-window">{children}</div>
      </div>
      <span
        className="painting-frame-rod"
        data-edge="bottom"
        aria-hidden="true"
      />
    </div>
  );
}
