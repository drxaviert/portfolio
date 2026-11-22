"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { hasReaderExit, requestReaderExit } from "@/components/nav/nav-flight";
import {
  CLOSE_VARIANTS,
  getCloseVariant,
  getServerCloseVariant,
  getServerShowCloseSwitch,
  getShowCloseSwitch,
  setCloseVariant,
  subscribeCloseVariant,
} from "./close-variant";
import { useDrawerActions } from "./drawer-actions";
import "./close-control.css";

export function useCloseVariant() {
  return useSyncExternalStore(
    subscribeCloseVariant,
    getCloseVariant,
    getServerCloseVariant,
  );
}

function useShowCloseSwitch() {
  return useSyncExternalStore(
    subscribeCloseVariant,
    getShowCloseSwitch,
    getServerShowCloseSwitch,
  );
}

/** The close glyph: the work icons' 20px / 1.5px stroke set. */
export function CloseIcon() {
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

/** The reader rail's left arrow, at the smaller size the text control needs. */
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

/**
 * The shared hover/focus label: `Close` plus the Esc key cap. Timing is the
 * nav's (150ms fade in, 300ms delay, released at once) and the placement comes
 * from the variant. The visible label never joins the accessible name, which
 * stays the action's sentence.
 */
function CloseHint({ place }: { place: "below-right" | "below-left" }) {
  return (
    <span aria-hidden="true" className={`xv-hint xv-hint--${place}`}>
      Close
      <kbd className="xv-hint-key">Esc</kbd>
    </span>
  );
}

/** `below`: PR 97's control, for reference. */
export function BelowClose() {
  const actions = useDrawerActions();

  if (!actions) return null;

  return (
    <button
      type="button"
      aria-label="Close work, back to home"
      className="wd-index-close xv-control"
      onClick={actions.exit}
    >
      <CloseIcon />
      <CloseHint place="below-right" />
    </button>
  );
}

/** `back`: the text control at the top-left of the list area. */
export function BackClose() {
  const actions = useDrawerActions();

  if (!actions) return null;

  return (
    <div className="xv-back-wrap">
      <button
        type="button"
        aria-label="Close work, back to home"
        className="xv-back xv-control"
        onClick={actions.exit}
      >
        <LeftArrowIcon />
        <span>Home</span>
        <CloseHint place="below-left" />
      </button>
    </div>
  );
}

/** `pill`: the sticky bottom-centre close, with its Esc hint inline. */
export function PillClose() {
  const actions = useDrawerActions();

  if (!actions) return null;

  return (
    <button
      type="button"
      aria-label="Close work, back to home"
      className="xv-pill xv-control"
      onClick={actions.exit}
    >
      <span>Close</span>
      <kbd className="xv-pill-key">Esc</kbd>
    </button>
  );
}

/** `corner`: the chip that straddles the panel's top-right corner. */
export function CornerClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close work, back to home"
      className="xv-corner xv-control"
      data-overlay-stop=""
      onClick={onClose}
    >
      <CloseIcon />
      <CloseHint place="below-right" />
    </button>
  );
}

/**
 * `nav`: the last item in the bar, after the toggle. It lives in the root
 * layout, so it rides the dock's fly-in; its slot is always present in this
 * variant, and only its visibility changes, so the bar never reflows between
 * `/` and `/work`.
 *
 * The button is the drawer's Esc gesture through the nav bridge. It is shown on
 * the index only: on a study the reader already has its own ways back, and the
 * "back to home" name would be untrue there.
 */
export function NavClose() {
  const variant = useCloseVariant();
  const pathname = usePathname();
  const shown = variant === "nav" && pathname === "/work";

  if (variant !== "nav") return null;

  return (
    <span className="xv-nav-slot" data-shown={shown ? "" : undefined}>
      <span
        aria-hidden="true"
        className="mx-6 hidden h-5 w-px shrink-0 bg-outline-variant md:block"
      />
      <button
        type="button"
        aria-label="Close work, back to home"
        aria-hidden={shown ? undefined : true}
        inert={!shown}
        tabIndex={shown ? 0 : -1}
        className="xv-nav-close xv-control"
        onClick={() => {
          if (!hasReaderExit()) return;

          requestReaderExit();
        }}
      >
        <CloseIcon />
        <CloseHint place="below-right" />
      </button>
    </span>
  );
}

/**
 * The dev switch. It is fixed to the viewport's bottom-left, above the drawer
 * and its scrim, and appears only in development or on a `?xv=` link.
 */
export function CloseVariantSwitch() {
  const variant = useCloseVariant();
  const show = useShowCloseSwitch();

  if (!show) return null;

  return (
    <div className="xv-dev" role="group" aria-label="Close placement variant">
      <span aria-hidden="true" className="xv-dev-label">
        close
      </span>
      {CLOSE_VARIANTS.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={variant === name}
          className="xv-dev-button"
          onClick={() => setCloseVariant(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
