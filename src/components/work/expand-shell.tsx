"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { cardSelector, useMorph } from "./use-morph";
import { READER_TITLE_ID } from "./parts";
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

  // Escape is a window gesture: it must work from anywhere in the reader. The
  // listener is bound once and kept current through a ref, so it never churns
  // while the morph state changes. Browser Back is the one exit this shell
  // cannot animate: Next hides the slot with React Activity in the same commit
  // that changes the URL, so these effects are already gone.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void closeRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        {children}
      </div>

      <div
        ref={titleRef}
        aria-hidden="true"
        className="wd-title-fly text-balance text-title-sm font-semibold md:text-title"
      />
    </div>
  );
}

/** Scroll lock, the focus trap and focus returning to the source card. */
function useOverlayBehaviour(
  panelRef: RefObject<HTMLElement | null>,
  slug: string,
) {
  useEffect(() => {
    const body = document.body;
    const overflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;

      const nodes = [
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.closest("[inert]"));
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelRef]);

  useEffect(
    () => () => {
      document
        .querySelector<HTMLElement>(cardSelector(slug))
        ?.focus({ preventScroll: true });
    },
    [slug],
  );
}
