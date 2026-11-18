"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { cardElement, useMorph } from "./use-morph";
import { enterDrawer, fadeStudyOut, leaveDrawer } from "./progression";
import { READER_TITLE_ID } from "./parts";
import {
  DOCK_SELECTOR,
  registerReaderClose,
} from "@/components/nav/nav-flight";
import { ReaderCloseProvider, useEscToClose } from "./reader-close";
import "./expand-shell.css";

/** One tab stop selector for both roots: the nav dock and the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  useOverlayBehaviour(
    panelRef,
    slug,
    phase === "open" || reduce,
    phase === "open",
  );

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
    // The laid-out copy: focusing a copy with no box is a no-op and leaves
    // focus on the body.
    const card = cardElement(slug);
    if (card) return card;
  }

  // A study opened from "Next project" usually has no card of its own; the nav's
  // logo is the nearest thing a keyboard user met. It lives in the root
  // layout's dock, not inside the homepage, so the fallback has to reach
  // outside main.
  return document.querySelector<HTMLElement>(
    `${DOCK_SELECTOR} a[aria-label="Home"]`,
  );
}

/** Scroll lock, the focus trap and focus returning to the source card. */
function useOverlayBehaviour(
  panelRef: RefObject<HTMLElement | null>,
  slug: string,
  lockHome: boolean,
  covered: boolean,
) {
  const inertRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const body = document.body;
    const overflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    // The inert flag below is cleared here, not in its own effect: this cleanup
    // runs before the focus return further down, so the card can take focus
    // back once the overlay is unmounted.
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
      inertRef.current?.removeAttribute("inert");
      inertRef.current = null;
    };
  }, []);

  // The reader is the only thing on screen: the homepage behind it leaves the
  // tab order and the accessibility tree, so no key or click can reach it.
  // Latched: once set, it stays until unmount, so a close after the morph keeps
  // the homepage inert to the end. A close that interrupts the morph never
  // sets it.
  useEffect(() => {
    if (!lockHome || inertRef.current) return;

    const background = document.querySelector<HTMLElement>("body > main");
    background?.setAttribute("inert", "");
    inertRef.current = background;
  }, [lockHome]);

  // The covered page's decoration (the ambient CSS loops and the shader) holds
  // its frames until the reader closes; see horizon-motion.css and faux-ui.css.
  useEffect(() => {
    if (!covered) return;

    const root = document.documentElement;
    root.dataset.overlayOpen = "true";

    return () => {
      delete root.dataset.overlayOpen;
    };
  }, [covered]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;

      // The nav is one element in the root layout, outside the panel; the
      // reader's tab order runs title → article → nav, then wraps back.
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

      // Open focuses the tabindex="-1" title, which is deliberately not in the
      // list. Sequential navigation from it restarts at the document in WebKit,
      // so an in-reader focus that is not a stop counts as the reader's edge.
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
  }, [panelRef]);

  // Focus goes back to the card the study closes into, and once the drawer is
  // gone the next one starts from whatever card it uses. A study -> study swap
  // is not a close: the drawer stays and its next reader takes focus itself.
  useEffect(
    () => () => {
      const path = window.location.pathname;

      if (path.startsWith("/work/") && path !== `/work/${slug}`) return;

      const origin = document.documentElement.dataset.drawerOrigin ?? slug;

      // The study on screen first, then the one the drawer was opened from:
      // close lands in the same card close picked.
      returnTarget([slug, origin])?.focus({ preventScroll: true });

      if (!path.startsWith("/work/")) {
        delete document.documentElement.dataset.drawerOrigin;
      }
    },
    [slug],
  );
}
