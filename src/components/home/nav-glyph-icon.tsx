/** The design-system glyph: one 20px stroke icon in the nav's item run. */
export function NavGlyphIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" />
      <circle cx="14.25" cy="5.75" r="3" />
      <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" />
      <path d="M14.25 11.1 17.4 14.25 14.25 17.4 11.1 14.25Z" />
    </svg>
  );
}
