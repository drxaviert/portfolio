"use client";

import type { MouseEvent, ReactNode } from "react";
import { useDrawerActions } from "./drawer-actions";
import "./back-link.css";

/**
 * The one way back, used on both sides of the drawer: "← Home" on the index and
 * "← Work" in a study. Same box, type, colour, hover fill, focus ring and
 * position, so the control does not move when a study opens or closes.
 *
 * The action is the drawer's own, never a route push: the index's runs the
 * drawer close (Esc's `exit`), the reader's steps back to the index (the
 * browser Back path that keeps the panel and restores the list's scroll). A
 * modified click is left to the browser, which follows the href — the homepage
 * from the index, the index from a study.
 *
 * The wrapper is the future menu's anchor. When the Work/Home hover menu ships,
 * pass it as `menu`; the wrapper already carries `data-back-menu-anchor` and the
 * menu node gets `data-back-menu-slot`. Nothing renders a menu today.
 */
export type BackLinkProps = {
  /** The visible word: "Home" or "Work". */
  label: string;
  /** The action's sentence; the arrow and the word stay the visible label. */
  ariaLabel: string;
  /** The fallback route for a modified click or a reader with no drawer. */
  href: string;
  onBack?: () => void;
  /** Reserved seam for the reader's future Work/Home hover menu. */
  menu?: ReactNode;
};

export function BackLink({
  label,
  ariaLabel,
  href,
  onBack,
  menu,
}: BackLinkProps) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onBack) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onBack();
  }

  return (
    <div className="wd-back" data-back-menu-anchor="">
      <a
        href={href}
        aria-label={ariaLabel}
        className="wd-back-link"
        onClick={onClick}
      >
        <LeftArrowIcon />
        <span className="wd-back-label">{label}</span>
      </a>

      {menu ? (
        <div className="wd-back-menu" data-back-menu-slot="">
          {menu}
        </div>
      ) : null}
    </div>
  );
}

/** The index's side: closes the drawer to the homepage. */
export function IndexBackLink() {
  const actions = useDrawerActions();

  return (
    <BackLink
      label="Home"
      ariaLabel="Close work, back to home"
      href="/"
      onBack={actions?.exit}
    />
  );
}

/** The reader's side: steps back to the index, panel and scroll intact. */
export function ReaderBackLink({ menu }: { menu?: ReactNode }) {
  const actions = useDrawerActions();

  return (
    <BackLink
      label="Work"
      ariaLabel="Back to work"
      href="/work"
      onBack={actions?.stepBack}
      menu={menu}
    />
  );
}

/** The left arrow, in the work icons' 20px / 1.5px stroke set. */
function LeftArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.5 10h-13M8.5 5l-5 5 5 5" />
    </svg>
  );
}
