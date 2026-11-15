import "./blur-stack.css";

/** Bands are declared 1:1 by `:nth-child` in blur-stack.css. */
const BAND_COUNT = 6;

/**
 * The progressive blur over the reader's top edge: six stacked
 * `backdrop-filter` bands in one box, weakest at the bottom, so content
 * scrolling up behind the nav blurs more the higher it goes.
 *
 * `height` is the nav's bottom edge as a CSS length. The caller derives it from
 * the same insets and bar height reader.css gives the nav (`--wd-nav-inset` +
 * `--wd-nav-height`), and the bands and their masks are percentages of it, so
 * the stack is pure geometry: nothing is measured, and nothing here animates —
 * only the content moves under it. The panel's stacking order puts the content
 * below the stack and the nav above it.
 */
export function BlurStack({ height }: { height: string }) {
  return (
    <div className="wd-blur-stack" style={{ height }}>
      {Array.from({ length: BAND_COUNT }, (_, index) => (
        <span key={index} className="wd-blur-band" aria-hidden="true" />
      ))}
    </div>
  );
}
