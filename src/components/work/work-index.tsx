"use client";

import type { WorkMeta } from "@/lib/work";
import { useDrawerActions } from "./drawer-actions";
import { WorkList } from "./work-list";
import "./work-index.css";

export { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

/**
 * The close glyph, drawn in the same 20px / 1.5px stroke set as the next link
 * and the reader rail's arrows.
 */
function CloseIcon() {
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
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" />
    </svg>
  );
}

/**
 * The index's own way out, at the panel's top-right under the nav.
 *
 * It is a real button and the first stop in the panel, so Tab from the focused
 * title lands on it (the trap's stranded-heading case). Its action is the
 * drawer's `exit`, not a route: Esc's own step-back-or-close, with the same
 * generation and burst guards, so it plays the pinned 300ms close and lands on
 * the homepage beside the nav.
 *
 * The visible box is 32px; the transparent pseudo-element grows the hit area to
 * 40px without moving the ring or the tooltip.
 */
function WorkCloseButton() {
  const actions = useDrawerActions();

  // Only ever rendered inside the drawer's provider; without one there is no
  // drawer to close.
  if (!actions) return null;

  return (
    <button
      type="button"
      aria-label="Close work, back to home"
      className="wd-index-close"
      onClick={actions.exit}
    >
      <CloseIcon />
      <span aria-hidden="true" className="wd-index-close-tooltip">
        Close
        <kbd className="wd-index-close-key">Esc</kbd>
      </span>
    </button>
  );
}

/**
 * The /work index: one list of case studies inside the drawer panel, under the
 * nav. The list owns its own scroll container and the hover thumbnail; this
 * wrapper exists so the drawer keeps its stable `INDEX_TITLE_ID` import, and it
 * adds the index's close control, which is chrome over the list rather than a
 * row in it.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  return (
    <>
      <WorkCloseButton />
      <WorkList works={works} />
    </>
  );
}
