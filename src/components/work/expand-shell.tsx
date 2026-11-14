"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { cardSelector, useMorph } from "./use-morph";
import { READER_TITLE_ID } from "./parts";
import { ReaderCloseProvider } from "./reader-nav";
import "./expand-shell.css";

/**
 * The intercepted reader. The page passes its `<Reader mode="overlay">` in as
 * children, so the MDX body and the reader stay server-rendered; this shell
 * only owns the backdrop, the morph and the flying title.
 */
export function ExpandShell({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const { phase, close } = useMorph(slug, panelRef, titleRef);

  const setLayer = useCallback((layer: HTMLDivElement | null) => {
    panelRef.current =
      layer?.querySelector<HTMLElement>(".wd-reader-panel") ?? null;
  }, []);

  useOverlayBehaviour(panelRef, slug);

  // The reader's nav and Esc gestures live inside the panel: the nav is a
  // server-rendered slot, so the close callback reaches it through context.
  // Esc is one listener, owned by the nav (see reader-nav.tsx).

  // The inert boundary comes off with the same commit that sets the phase, so
  // the title can only take focus after React has rendered the open state.
  useEffect(() => {
    if (phase !== "open") return;

    panelRef.current
      ?.querySelector<HTMLElement>(`#${READER_TITLE_ID}`)
      ?.focus({ preventScroll: true });
  }, [phase, panelRef]);

  return (
    <div ref={setLayer} className="wd-expand-layer" data-phase={phase}>
      <div
        className="wd-expand-backdrop"
        aria-hidden="true"
        onClick={() => void close()}
      />

      <div className="wd-expand-content" inert={phase !== "open"}>
        <ReaderCloseProvider close={close}>{children}</ReaderCloseProvider>
      </div>

      <div
        ref={titleRef}
        aria-hidden="true"
        className="wd-title-fly text-balance text-title-sm font-semibold md:text-title"
      />
    </div>
  );
}

/** The control focus came from: its card, or the nav when a study has none. */
function returnTarget(slug: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(cardSelector(slug)) ??
    // A study opened from "Next project" has no card of its own; the homepage
    // nav's logo is the nearest thing a keyboard user met on the page.
    document.querySelector<HTMLElement>('body > main a[aria-label="Home"]')
  );
}

/** Scroll lock, the focus trap and focus returning to the source card. */
function useOverlayBehaviour(
  panelRef: RefObject<HTMLElement | null>,
  slug: string,
) {
  useEffect(() => {
    const body = document.body;
    const background = document.querySelector<HTMLElement>("body > main");
    const overflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    // The reader is the only thing on screen: the homepage behind it leaves the
    // tab order and the accessibility tree, so no key or click can reach it.
    // This cleanup runs before the focus return below, so the card can take
    // focus back once the overlay is unmounted.
    background?.setAttribute("inert", "");

    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
      background?.removeAttribute("inert");
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;

      // Unrendered nodes are not tab stops: the mobile actions stay in the DOM
      // at 1024px and up, so without this the forward wrap keys off a control
      // that cannot be reached.
      const nodes = [
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (node) =>
          !node.closest("[inert]") && node.getClientRects().length > 0,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inPanel = active instanceof HTMLElement && root.contains(active);

      // Open focuses the tabindex="-1" title, which is deliberately not in the
      // list. Sequential navigation from it restarts at the document in WebKit,
      // so an in-panel focus that is not a stop counts as the panel's edge.
      const stranded =
        active instanceof HTMLElement && inPanel && !nodes.includes(active);

      if (event.shiftKey) {
        if (!inPanel || stranded || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!inPanel || stranded || active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelRef]);

  useEffect(
    () => () => {
      returnTarget(slug)?.focus({ preventScroll: true });
    },
    [slug],
  );
}
