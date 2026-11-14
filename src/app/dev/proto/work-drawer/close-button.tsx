"use client";

import type { CSSProperties } from "react";

/** Shared close control: floating in the reader, or inside the header bar. */
export function CloseButton({
  onRequestClose,
  className = "",
  style,
}: {
  onRequestClose: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      data-wd-close
      aria-label="Close case study"
      className={`wd-close ${className}`}
      style={style}
      onClick={onRequestClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  );
}
