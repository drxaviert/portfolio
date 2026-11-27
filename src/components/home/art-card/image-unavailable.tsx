/**
 * The intentional failure state inside a painting frame.
 *
 * This is deliberately not the bundled fallback painting: the record is real,
 * only the image bytes failed. The copy says so, and the card/dialog add their
 * own note, so an outage never looks like an artwork choice.
 */
export function ImageUnavailable() {
  return (
    <div className="art-image-unavailable">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect
          x="3.5"
          y="5"
          width="17"
          height="14"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M4.5 15.5 9 11l3.5 3.5 3-3 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="9" r="1.2" fill="currentColor" />
        <path
          d="M3 3l18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <p className="art-image-unavailable-title">Image unavailable</p>
      <p className="art-image-unavailable-copy">
        The image service did not respond.
      </p>
    </div>
  );
}
