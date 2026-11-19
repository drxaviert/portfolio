"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cardElement, useMorph } from "./use-morph";
import { enterDrawer, fadeStudyOut, leaveDrawer } from "./progression";
import { READER_TITLE_ID } from "./parts";
import {
  DOCK_SELECTOR,
  registerReaderClose,
} from "@/components/nav/nav-flight";
import { sheetOrigin } from "@/lib/work-sheet-state";
import { ReaderCloseProvider, useEscToClose } from "./reader-close";
import { useOverlayBehaviour } from "./use-overlay-behaviour";
import "./expand-shell.css";

/**
 * The reader's shell over the homepage. The page passes its `<Reader>` in as
 * children, so the MDX body and the reader stay server-rendered; this shell
 * only owns the backdrop and the panel's morph. A direct load renders it
 * `resting`: the reader is already the destination, so it starts open with no
 * morph and no nav flight, exactly where a soft navigation's morph lands.
 */
export function ExpandShell({
  slug,
  resting = false,
  children,
}: {
  slug: string;
  resting?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const { phase, reveal, handoff, close } = useMorph(slug, panelRef, {
    resting,
  });

  const setLayer = useCallback((layer: HTMLDivElement | null) => {
    panelRef.current =
      layer?.querySelector<HTMLElement>(".wd-reader-panel") ?? null;
  }, []);

  // Esc and the nav's logo/"Work" both close through this shell: Esc here, the
  // nav through nav-flight (it lives in the root layout, outside this panel).
  useEscToClose(close);
  useEffect(() => registerReaderClose(close), [close]);

  // The drawer is one session across study swaps. A Back/Forward replaces this
  // shell without a click to announce anything, so the incoming mount reads
  // this flag and joins the drawer instead of flying out of a card.
  useEffect(() => {
    enterDrawer();

    return () => {
      // The next study's shell reads the flag before this cleanup runs in the
      // same commit, so the route is the safe test: a drawer that leaves to
      // the homepage ends the session; a swap keeps it.
      if (!window.location.pathname.startsWith("/work/")) leaveDrawer();
    };
  }, []);

  // Back/Forward from one study to another: the article on screen leaves on
  // the reader's close fade. The route commit is the router's and may land
  // before that fade ends, in which case the entrance is the visible half of
  // the swap. The incoming mount itself reads the open-drawer flag above.
  useEffect(() => {
    function onPopState() {
      const next = window.location.pathname;

      if (!next.startsWith("/work/") || next === `/work/${slug}`) return;

      fadeStudyOut();
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [slug]);

  // The homepage goes inert once the morph has landed, not as it starts:
  // inertness is inherited, so flagging `main` restyles every homepage element
  // (~50ms at 4x CPU), and that belongs after the morph's first frames. The
  // focus trap and the backdrop hold keys and clicks in the meantime. A
  // reduced-motion fade has no morph to protect; a direct load starts open.
  const reduce = useReducedMotion() ?? false;
  useOverlayBehaviour(panelRef, {
    lockHome: phase === "open" || reduce,
    covered: phase === "open",
    // Focus goes back to the card of the study the drawer is showing, then to
    // the card it was opened from: a "next project" swap changes what the
    // drawer shows without changing the origin kept for the reverse morph. A
    // study -> study swap is not a close: the drawer stays and its next reader
    // takes focus itself.
    returnFocus: () => {
      const path = window.location.pathname;

      if (path.startsWith("/work/") && path !== `/work/${slug}`) return;

      const origin = document.documentElement.dataset.drawerOrigin ?? slug;

      // The study on screen first, then the one the drawer was opened from.
      returnTarget([slug, origin])?.focus({ preventScroll: true });

      if (!path.startsWith("/work/")) {
        delete document.documentElement.dataset.drawerOrigin;
      }
    },
  });

  // The inert boundary comes off with the same commit that sets the phase, so
  // the title can only take focus after React has rendered the open state.
  useEffect(() => {
    if (phase !== "open") return;

    panelRef.current
      ?.querySelector<HTMLElement>(`#${READER_TITLE_ID}`)
      ?.focus({ preventScroll: true });
  }, [phase, panelRef]);

  return (
    <div
      ref={setLayer}
      className="wd-expand-layer"
      data-phase={phase}
      data-reveal={reveal}
      // The layer is new, the drawer is not: keep the backdrop from fading in
      // again on a study -> study swap.
      data-handoff={handoff ? "" : undefined}
    >
      <div
        className="wd-expand-backdrop"
        aria-hidden="true"
        onClick={() => void close()}
      />

      <div className="wd-expand-content" inert={phase !== "open"}>
        <ReaderCloseProvider close={close}>{children}</ReaderCloseProvider>
      </div>
    </div>
  );
}

/** The control focus came from: its card, or the persistent nav with no card. */
function returnTarget(slugs: string[]): HTMLElement | null {
  for (const slug of slugs) {
    // The card showing the study, then any laid-out copy carrying the morph
    // hook: focusing a copy with no box is a no-op and leaves focus on the body.
    const card = shownCard(slug) ?? cardElement(slug);
    if (card) return card;
  }

  // No card on screen for any of these studies: the nav's logo is the nearest
  // thing a keyboard user met. It lives in the root layout's dock, not inside
  // the homepage, so the fallback has to reach outside main.
  return document.querySelector<HTMLElement>(
    `${DOCK_SELECTOR} a[aria-label="Home"]`,
  );
}

/**
 * The card showing `slug` now. Every carousel card carries its study's slug,
 * not only the featured one with the morph hook: after "next project" the
 * study on screen is no longer the one with a card in the first slot. A card
 * in the slots past the row's edge is hidden, so it cannot take focus.
 */
function shownCard(slug: string): HTMLElement | null {
  // A reader opened from the work sheet returns to the sheet item it was
  // clicked from, not to the homepage card that carries the same slug.
  const fromSheet = sheetOrigin(slug);
  if (fromSheet) return fromSheet;

  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-work-card="${slug}"], [data-work-slug="${slug}"]`,
  );

  return (
    Array.from(candidates).find(
      (candidate) =>
        candidate.getClientRects().length > 0 &&
        window.getComputedStyle(candidate).visibility !== "hidden",
    ) ?? null
  );
}
