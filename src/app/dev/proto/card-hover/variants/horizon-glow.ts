/**
 * Horizon-palette glow, for the ring variants that light the edge with the
 * page's own horizon colours instead of --orb-gradient.
 *
 * The --horizon-* tokens are 6%-alpha background tints (and the base/mid/end
 * stops are near-white or near-black), so none of them can paint a 1px ring.
 * What survives at 1px is the two blob hues, so the ring gradient is built
 * from exactly those hues at a boosted alpha (--ch-boost, on the panel).
 * Values below are the RGB triples from globals.css, phase for phase:
 *   day   blob-left #60a8e2 / blob-right #0071c1
 *   dawn  blob-left #ff90b9 / blob-right #cb83ff
 *   dusk  blob-left #b4d8ff / blob-right #ffb451
 *   night blob-left #6763e4 / blob-right #afffea
 */
export const HORIZON_GLOW_CSS = `
[data-variant] {
  --ch-boost: 55%;
  --ch-horizon-a: rgb(96 168 226);
  --ch-horizon-b: rgb(0 113 193);
  --ch-horizon-glow: linear-gradient(
    45deg,
    color-mix(in oklab, var(--ch-horizon-a) var(--ch-boost), transparent) 0%,
    color-mix(in oklab, var(--ch-horizon-b) var(--ch-boost), transparent) 100%
  );
}

[data-phase="day"] [data-variant] {
  --ch-horizon-a: rgb(96 168 226);
  --ch-horizon-b: rgb(0 113 193);
}

[data-phase="dawn"] [data-variant] {
  --ch-horizon-a: rgb(255 144 185);
  --ch-horizon-b: rgb(203 131 255);
}

[data-phase="dusk"] [data-variant] {
  --ch-horizon-a: rgb(180 216 255);
  --ch-horizon-b: rgb(255 180 81);
}

[data-phase="night"] [data-variant] {
  --ch-horizon-a: rgb(103 99 228);
  --ch-horizon-b: rgb(175 255 234);
}
`;
