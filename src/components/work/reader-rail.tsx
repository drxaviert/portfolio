"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";
import { useDrawerActions } from "./drawer-actions";
import { useShowTop } from "./use-show-top";

/**
 * The ways back, from inside a study. Both placements share the same behaviour:
 * the desktop pair sits in the left margin, the thumb pair is fixed to the
 * bottom corners of the panel below 1024px.
 *
 * "← Work" steps the drawer back to the index (the drawer itself, not a new
 * page), and the browser's Back does the same thing: the index is the drawer's
 * own previous view. The panel never moves for it; only the content fades.
 */

function ArrowIcon({ up = false }: { up?: boolean }) {
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
      {up ? (
        <path d="M10 16.5v-13M5 8.5l5-5 5 5" />
      ) : (
        <path d="M16.5 10h-13M8.5 5l-5 5 5 5" />
      )}
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

/**
 * A "back" link is the drawer's own step back; modified clicks (a new tab, a
 * new window) are left to the browser, the way the nav's logo and "Work" are.
 */
function stepBackOnClick(stepBack: (() => void) | undefined) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!stepBack) return;
    if (event.button !== 0) return;

    const modified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified) return;

    event.preventDefault();
    stepBack();
  };
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
      <ArrowIcon up />
      {text ? "Top" : null}
    </button>
  );
}

/** The desktop pair inside `.wd-rail`: sticky under the nav and near the foot. */
export function ReaderRail({ onStepBack }: { onStepBack?: () => void }) {
  const actions = useDrawerActions();
  const stepBack = onStepBack ?? actions?.stepBack;
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <>
      <Link
        href="/work"
        className="wd-rail-work"
        onClick={stepBackOnClick(stepBack)}
      >
        <ArrowIcon />
        Work
      </Link>

      <TopButton
        className="wd-rail-top"
        visible={visible}
        onClick={() => scrollToTop(scrollEl)}
        text
      />
    </>
  );
}

/** The two 44px targets below 1024px: bottom left and bottom right. */
export function ReaderMobileActions({
  onStepBack,
}: {
  onStepBack?: () => void;
}) {
  const actions = useDrawerActions();
  const stepBack = onStepBack ?? actions?.stepBack;
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <div className="wd-reader-actions">
      <Link
        href="/work"
        aria-label="Back to work"
        className="wd-reader-action"
        onClick={stepBackOnClick(stepBack)}
      >
        <ArrowIcon />
      </Link>

      <TopButton
        className="wd-reader-action"
        visible={visible}
        onClick={() => scrollToTop(scrollEl)}
      />
    </div>
  );
}
