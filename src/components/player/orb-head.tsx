/**
 * The 36px orb mark. The eyes are the resting face; the ring player adds the
 * pause/play glyphs that the CSS reveals on hover/focus (or at rest when
 * paused).
 */
export function OrbHead({
  ring = false,
  paused = false,
}: {
  ring?: boolean;
  paused?: boolean;
}) {
  return (
    <span
      className="orb-head"
      data-ring={ring ? "true" : undefined}
      data-paused={paused ? "true" : undefined}
    >
      <span className="orb-eyes" aria-hidden="true">
        <span />
        <span />
      </span>
      {ring ? (
        <>
          <span className="orb-glyph orb-glyph-pause" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="orb-glyph orb-glyph-play" aria-hidden="true">
            <svg width="12" height="14" viewBox="0 0 12 14" focusable="false">
              <path
                d="M1.2 1.4 10.4 7 1.2 12.6Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </>
      ) : null}
    </span>
  );
}
