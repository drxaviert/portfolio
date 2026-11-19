"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { DOCK_SELECTOR } from "@/components/nav/nav-flight";

/** One tab stop selector for both roots: the nav dock and the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The page behind an overlay does not scroll, and the scrollbar's width is put
 * back as padding so the page does not shift sideways when it goes.
 *
 * Counted, not saved: the sheet can be open under a reader, and the reader's
 * unmount must not hand the page its scroll back while the sheet still holds
 * it. The first lock records the page's own values, the last release restores
 * them.
 */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

function lockPageScroll(): () => void {
  const body = document.body;

  if (locks === 0) {
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    saved = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
  }

  locks += 1;

  return () => {
    locks -= 1;

    if (locks > 0 || !saved) return;

    body.style.overflow = saved.overflow;
    body.style.paddingRight = saved.paddingRight;
    saved = null;
  };
}

/**
 * The covered page's decoration (the ambient CSS loops and the shader) holds
 * its frames until the overlay closes; see horizon-motion.css and faux-ui.css.
 * Held by every open overlay, so a reader closing over the sheet does not
 * restart the loops underneath it.
 */
const covered = new Set<symbol>();

function holdDecoration(): () => void {
  const token = Symbol("overlay");

  covered.add(token);
  document.documentElement.dataset.overlayOpen = "true";

  return () => {
    covered.delete(token);

    if (covered.size === 0) delete document.documentElement.dataset.overlayOpen;
  };
}

/**
 * What every overlay over the homepage shares: the page's scroll lock, the
 * ambient decoration held still, the homepage taken out of the tab order and
 * the accessibility tree, and one focus trap across the panel and the nav.
 *
 * The nav lives in the root layout, outside the overlay, so it is never part of
 * the inert background: the trap cycles panel -> nav -> panel.
 */
export function useOverlayBehaviour(
  panelRef: RefObject<HTMLElement | null>,
  options: {
    /** Hold the page's scroll while the overlay is on screen. */
    lockScroll: boolean;
    /** Take the homepage out of the tab order (the overlay owns the page). */
    lockHome: boolean;
    /** Hold the ambient background still. */
    covered: boolean;
    /** Run the tab trap. False while another overlay on top owns focus. */
    trap?: boolean;
    /** Called on unmount, once the background is interactive again. */
    returnFocus?: () => void;
  },
) {
  const {
    lockScroll,
    lockHome,
    covered: holdFrames,
    trap = true,
    returnFocus,
  } = options;
  const inertRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef(returnFocus);

  // Keep the unmount callback current without reading or writing a ref during
  // render: the effect below captures only this ref.
  useEffect(() => {
    returnFocusRef.current = returnFocus;
  });

  // The lock follows the phase: the shell holds the page while it is on
  // screen, and releases it the moment it is closed (including when a cached
  // tree is hidden with the shell still believing it was open).
  useEffect(() => {
    if (!lockScroll) return;

    return lockPageScroll();
  }, [lockScroll]);

  // The homepage leaves the tab order and the accessibility tree once the
  // overlay owns it, and gets both back when the shell closes.
  useEffect(() => {
    if (!lockHome) {
      inertRef.current?.removeAttribute("inert");
      inertRef.current = null;
      return;
    }

    if (inertRef.current) return;

    const background = document.querySelector<HTMLElement>("body > main");
    background?.setAttribute("inert", "");
    inertRef.current = background;
  }, [lockHome]);

  // Its own unmount-only cleanup: a close flips `lockHome` back before the
  // overlay is gone, and the background has to stay inert through that exit.
  useEffect(
    () => () => {
      inertRef.current?.removeAttribute("inert");
      inertRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!holdFrames) return;

    return holdDecoration();
  }, [holdFrames]);

  useEffect(() => {
    if (!trap) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;

      // The nav is one element in the root layout, outside the panel; the tab
      // order runs panel -> nav, then wraps back.
      const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR);
      const stops = (element: HTMLElement | null) =>
        element
          ? [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
              // Unrendered nodes are not tab stops: the mobile actions stay in
              // the DOM at 1024px and up, so without this the forward wrap keys
              // off a control that cannot be reached.
              (node) =>
                !node.closest("[inert]") && node.getClientRects().length > 0,
            )
          : [];

      const panelStops = stops(root);
      const dockStops = stops(dock);

      if (panelStops.length === 0 && dockStops.length === 0) return;

      const panelFirst = panelStops[0];
      const panelLast = panelStops[panelStops.length - 1];
      const dockFirst = dockStops[0];
      const dockLast = dockStops[dockStops.length - 1];
      const active = document.activeElement;
      const inPanel = active instanceof HTMLElement && root.contains(active);
      const inDock =
        active instanceof HTMLElement && (dock?.contains(active) ?? false);
      const inside = inPanel || inDock;

      // An open focuses a tabindex="-1" heading, which is deliberately not in
      // the list. Sequential navigation from it restarts at the document in
      // WebKit, so a focus that is inside but not a stop counts as the edge.
      const stranded =
        active instanceof HTMLElement &&
        inside &&
        !panelStops.includes(active) &&
        !dockStops.includes(active);

      if (event.shiftKey) {
        if (!inside || stranded) {
          event.preventDefault();
          (dockLast ?? panelLast)?.focus();
          return;
        }

        if (inPanel && active === panelFirst) {
          event.preventDefault();
          (dockLast ?? panelLast)?.focus();
        } else if (inDock && active === dockFirst) {
          event.preventDefault();
          panelLast?.focus();
        }

        return;
      }

      if (!inside || stranded) {
        event.preventDefault();
        (panelFirst ?? dockFirst)?.focus();
        return;
      }

      if (inPanel && active === panelLast) {
        event.preventDefault();
        (dockFirst ?? panelFirst)?.focus();
      } else if (inDock && active === dockLast) {
        event.preventDefault();
        (panelFirst ?? dockFirst)?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelRef, trap]);

  // Declared last: the effects above release the page first, so focus returns
  // to a live control rather than one inside an inert subtree. The callback
  // decides whether this is a real close: development Strict Mode runs the
  // cleanup once on mount, with the overlay still on screen.
  useEffect(
    () => () => {
      returnFocusRef.current?.();
    },
    [],
  );
}
