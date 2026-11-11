/**
 * The three ring layers every hover host carries: the frame (the 1px edge), the
 * glow inside it, and the host's fill one pixel inside the frame.
 *
 * They paint at negative z-index inside an `isolation: isolate` host (see
 * ring-hover.css), so in-flow content stays above them and the host's own
 * background can be dropped in favour of the surface layer.
 */
export function RingLayers({ fill }: { fill: string }) {
  return (
    <>
      <span className="ring-frame" aria-hidden="true">
        <span className="ring-glow" aria-hidden="true" />
      </span>
      <span className={`ring-surface ${fill}`} aria-hidden="true" />
    </>
  );
}
