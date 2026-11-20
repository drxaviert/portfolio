"use client";

import type { KeyboardEvent } from "react";
import { Segment, SegmentTrack } from "@/components/theme/theme-toggle";
import type { WorkLayout } from "./layout-preference";

const OPTIONS: { value: WorkLayout; label: string; tooltip: string }[] = [
  { value: "grid", label: "Grid view", tooltip: "Grid view" },
  { value: "list", label: "List view", tooltip: "List view" },
];

/** The two layout glyphs, drawn in the theme toggle's 16px stroke language. */
function LayoutGlyph({ kind }: { kind: WorkLayout }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "grid" ? (
        <>
          <rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1" />
          <rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1" />
          <rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1" />
          <rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1" />
        </>
      ) : (
        <>
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          <circle cx="2.5" cy="4" r="0.4" />
          <circle cx="2.5" cy="8" r="0.4" />
          <circle cx="2.5" cy="12" r="0.4" />
        </>
      )}
    </svg>
  );
}

/**
 * The index's grid / list switch. It is the theme toggle's own track and
 * capsule: same segments, same stretch-and-snap highlight, same tooltip and
 * same 40px finger target on a coarse pointer. Only the glyphs are new.
 */
export function LayoutToggle({
  value,
  onChange,
}: {
  value: WorkLayout;
  onChange: (next: WorkLayout) => void;
}) {
  const selected = value === "list" ? 1 : 0;

  function onKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + OPTIONS.length - 1) % OPTIONS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = OPTIONS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(OPTIONS[next].value);
    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <SegmentTrack
      label="Layout"
      segments={OPTIONS.length}
      selectedIndex={selected}
      data-layout-track="true"
    >
      {OPTIONS.map((option, index) => (
        <Segment
          key={option.value}
          selected={value === option.value}
          label={option.label}
          tooltip={option.tooltip}
          hitArea="finger"
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <LayoutGlyph kind={option.value} />
        </Segment>
      ))}
    </SegmentTrack>
  );
}
