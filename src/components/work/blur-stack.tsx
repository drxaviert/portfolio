import "./blur-stack.css";

/** Bands are declared 1:1 by `:nth-child` in blur-stack.css. */
const BAND_COUNT = 6;

export type BlurStackProps = {
  /**
   * The stack's height as a CSS length. Omit it to take the caller's
   * `--wd-blur-height`, or `100%` of the containing block.
   */
  height?: string;
  /** Which edge the blur builds toward. Defaults to the reader's top edge. */
  edge?: "top" | "bottom";
  /**
   * Paint the panel-surface tint under the bands. The reader's nav sits on a
   * tinted zone; the viewport bands do not, so the glow behind them keeps its
   * colour.
   */
  tint?: boolean;
};

/**
 * Six stacked `backdrop-filter` bands in one box, weakest at the inner edge, so
 * content scrolling under the edge blurs more the closer it gets to it.
 *
 * `height` is a CSS length. The reader derives it from the same insets and bar
 * height reader.css gives the nav (`--wd-nav-inset` + `--wd-nav-height`); the
 * viewport bands let the band's CSS own it. The bands and their masks are
 * percentages of the box, so the stack is pure geometry: nothing is measured,
 * and nothing here animates — only the content moves under it.
 */
export function BlurStack({
  height,
  edge = "top",
  tint = true,
}: BlurStackProps) {
  return (
    <div
      className="wd-blur-stack"
      data-edge={edge === "bottom" ? "bottom" : undefined}
      data-tint={tint ? undefined : "none"}
      style={height ? { height } : undefined}
    >
      {Array.from({ length: BAND_COUNT }, (_, index) => (
        <span key={index} className="wd-blur-band" aria-hidden="true" />
      ))}
    </div>
  );
}
