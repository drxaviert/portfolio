import "./canvas-edge-blur.css";

/** Six bands, weakest at the inner boundary. Declared 1:1 in the CSS. */
const BAND_COUNT = 6;

/**
 * Progressive blur at the four edges of the canvas panel: sharp in the middle,
 * blur rising to `--cv-edge-blur-max` at the very edge, with a faint surface
 * tint so the blur reads as a vignette rather than a smear.
 *
 * The technique is the reader and viewport stacks' (`work/blur-stack.css`):
 * static `backdrop-filter` bands sharing one box, each masked to the slice it
 * owns and fading into the next, painted weakest first so every band also
 * blurs the result under it. This one differs in three ways: the mask is the
 * union of a vertical and a horizontal ramp, so all four edges ramp toward
 * their own boundary and the corners stay continuous; the tint is a themed
 * surface at 8%; and the whole overlay dips while an opened tile owns the
 * screen (see canvas-edge-blur.css and `.cv-reader`'s state attributes).
 *
 * Pure CSS geometry: the depth is a clamp of vw, the ramps are lengths of that
 * depth, and nothing here is measured, animated or pointer-interactive.
 */
export function CanvasEdgeBlur() {
  return (
    <div className="cv-edge-blur" aria-hidden="true">
      {Array.from({ length: BAND_COUNT }, (_, index) => (
        <span key={index} className="cv-edge-blur__band" aria-hidden="true" />
      ))}
    </div>
  );
}
