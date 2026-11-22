"use client";

import { useSyncExternalStore } from "react";
import { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";
import { useShowTop } from "./use-show-top";

/**
 * The reader's reach-to-top controls. The way back to the index is the shared
 * BackLink above the article (back-link.tsx), on every width; these are only
 * the second half of the old pair: "↑ Top" in the desktop margin rail and the
 * thumb-reach button at the panel's foot below 1024px.
 */

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 16.5v-13M5 8.5l5-5 5 5" />
    </svg>
  );
}

/** The reader's scroll container, which exists by the time the browser runs. */
function useScrollEl(): HTMLElement | null {
  return useSyncExternalStore(
    subscribeToMount,
    () => document.getElementById(READER_SCROLL_ID),
    () => null,
  );
}

/**
 * The study is server-rendered, so the rail cannot hold a ref to the scroll
 * container. It reads the element from the document instead: the store never
 * changes, so one notification on subscribe is enough to re-read it once the
 * panel is in the DOM.
 */
function subscribeToMount(onStoreChange: () => void) {
  onStoreChange();

  return () => {};
}

/** Back to the top of the study, then focus back on the title. */
function scrollToTop(scrollEl: HTMLElement | null) {
  if (!scrollEl) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  scrollEl.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  document.getElementById(READER_TITLE_ID)?.focus({ preventScroll: true });
}

function TopButton({
  className,
  visible,
  onClick,
  text = false,
}: {
  className: string;
  visible: boolean;
  onClick: () => void;
  /** The desktop rail names the control; the thumb button is icon-only. */
  text?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Back to top"
      className={className}
      data-visible={visible}
      inert={!visible}
      onClick={onClick}
    >
      <ArrowIcon />
      {text ? "Top" : null}
    </button>
  );
}

/** The desktop rail's "↑ Top", sticky near the foot of the panel. */
export function ReaderRail() {
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <TopButton
      className="wd-rail-top"
      visible={visible}
      onClick={() => scrollToTop(scrollEl)}
      text
    />
  );
}

/** Below 1024px: the 44px "↑ Top" target in the panel's bottom-right corner. */
export function ReaderMobileActions() {
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <div className="wd-reader-actions">
      <TopButton
        className="wd-reader-action"
        visible={visible}
        onClick={() => scrollToTop(scrollEl)}
      />
    </div>
  );
}
