"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";
import { useReaderClose } from "./reader-close";
import { useShowTop } from "./use-show-top";

/**
 * The ways back, from inside the reader. Both placements share the same
 * behaviour: the desktop pair sits in the left margin, the thumb pair is fixed
 * to the bottom corners of the panel below 1024px.
 *
 * `onClose` is the overlay's reverse morph. `Reader` is server-rendered, so the
 * rail takes it from the shell's context when no prop is passed; on a direct
 * load there is no close, and the link navigates to `/` as a normal link.
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
 * The reader is server-rendered, so the rail cannot hold a ref to the scroll
 * container. It reads the element from the document instead: the store never
 * changes, so one notification on subscribe is enough to re-read it once the
 * panel is in the DOM.
 */
function subscribeToMount(onStoreChange: () => void) {
  onStoreChange();

  return () => {};
}

/** Back to the top of the reader, then focus back on the title. */
function scrollToTop(scrollEl: HTMLElement | null) {
  if (!scrollEl) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  scrollEl.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  document.getElementById(READER_TITLE_ID)?.focus({ preventScroll: true });
}

/**
 * A close link leaves modified clicks (a new tab, a new window) to the browser,
 * the way the nav's logo and "Work" do.
 */
function closeOnClick(close: (() => void) | undefined) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!close) return;
    if (event.button !== 0) return;

    const modified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified) return;

    event.preventDefault();
    close();
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
export function ReaderRail({ onClose }: { onClose?: () => void }) {
  const fromShell = useReaderClose();
  const close = onClose ?? fromShell;
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <>
      <Link href="/" className="wd-rail-work" onClick={closeOnClick(close)}>
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
export function ReaderMobileActions({ onClose }: { onClose?: () => void }) {
  const fromShell = useReaderClose();
  const close = onClose ?? fromShell;
  const scrollEl = useScrollEl();
  const visible = useShowTop(scrollEl);

  return (
    <div className="wd-reader-actions">
      <Link
        href="/"
        aria-label="Back to work"
        className="wd-reader-action"
        onClick={closeOnClick(close)}
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
