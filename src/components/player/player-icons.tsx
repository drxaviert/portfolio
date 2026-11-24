/** The transport glyphs, shared by the card and the satellite. */
export function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4 1.75 L10.5 6 L4 10.25 Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="3"
        y="1.75"
        width="2.5"
        height="8.5"
        rx="0.75"
        fill="currentColor"
      />
      <rect
        x="6.5"
        y="1.75"
        width="2.5"
        height="8.5"
        rx="0.75"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The 13px satellite dot needs chunkier bars than the 12px transport viewBox:
 * at 7px its 1.46px bars and 0.58px gap antialias into one blob on 1x screens.
 */
export function SatellitePauseIcon({ size = 7 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" aria-hidden="true">
      <rect
        x="1.1"
        y="0.9"
        width="1.5"
        height="5.2"
        rx="0.4"
        fill="currentColor"
      />
      <rect
        x="4.4"
        y="0.9"
        width="1.5"
        height="5.2"
        rx="0.4"
        fill="currentColor"
      />
    </svg>
  );
}

export function SpinnerIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <path
        d="M6 1.5A4.5 4.5 0 0 1 10.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
