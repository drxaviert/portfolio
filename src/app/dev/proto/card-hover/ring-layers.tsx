/**
 * The three ring layers shared by every ring variant: frame (the 1px edge),
 * glow (inside the frame, only visible through the ring), surface (the host's
 * fill, clipped one pixel inside the frame).
 *
 * They sit at negative z-index inside an `isolation: isolate` host, so in-flow
 * content paints above them and the host's own background can be dropped.
 */
export function RingLayers({ fill }: { fill: string }) {
  return (
    <>
      <span className="ch-ring-frame" aria-hidden="true">
        <span className="ch-ring-glow" aria-hidden="true" />
      </span>
      <span className={`ch-ring-surface ${fill}`} aria-hidden="true" />
    </>
  );
}
