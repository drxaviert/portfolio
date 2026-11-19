"use client";

import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DOCK_SELECTOR, registerReaderClose } from "@/components/nav/nav-flight";
import { DrawerActionsProvider, useEscToClose } from "./drawer-actions";
import { READER_TITLE_ID } from "./parts";
import { useCloseBehaviour } from "./proto-layout-toggle";
import {
  capsuleElement,
  laidOut,
  visibleCard,
  useDrawerMorph,
} from "./use-morph";
import { copyScrollOffsets, snapshotElement } from "./view-snapshot";
import { useOverlayBehaviour } from "./use-overlay-behaviour";
import { INDEX_TITLE_ID } from "./work-index";
import "./drawer-shell.css";

/**
 * One view inside the panel: the route it belongs to and the children it was
 * rendered with. Held as a snapshot so a swap always paints two distinct views.
 */
type DrawerEntry = { key: string; node: ReactNode };

/**
 * The one drawer: `/work` and every `/work/<slug>` are this panel.
 *
 * It is the project reader's shell, generalised. The panel, the inset, the
 * radius, the shadow, the backdrop, the nav flight and both FLIPs are exactly
 * the reader's (`reader.css`, `use-morph.ts`); what changes is the content.
 * Switching a study, or stepping back to the index, cross-fades the content
 * inside a panel that does not move.
 *
 * One instance serves every `/work*` URL because the routes share this segment:
 * the pages below swap, the shell does not. A direct load arrives with the
 * panel already in the document, open at rest.
 */
export function DrawerShell({
  children,
  resting = false,
}: {
  children: ReactNode;
  resting?: boolean;
}) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/work/")
    ? pathname.slice("/work/".length)
    : null;
  const onIndex = slug === null;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { phase, reveal, close, stepBack, originRef } = useDrawerMorph(
    panelRef,
    { slug, route: pathname, resting },
  );
  const reduce = useReducedMotion() ?? false;
  const closeBehaviour = useCloseBehaviour();
  const titleId = onIndex ? INDEX_TITLE_ID : READER_TITLE_ID;

  // The view on screen (its route and the children it was rendered with), plus
  // the copy a swap leaves behind. The copy is a DOM snapshot, not a re-render:
  // the page under this layout is a router slot that paints the new route's
  // content in place, so re-rendering the old element would freeze nothing.
  const [view, setView] = useState<DrawerEntry>({
    key: pathname,
    node: children,
  });
  const [enteringKey, setEnteringKey] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const exitRef = useRef<{ key: string; copy: HTMLElement | null } | null>(null);

  // A pathname change is a content swap: keep the view that is on screen and
  // let the new one fade in under it. This is a *cross*-fade — the two views
  // overlap, the panel keeps its box, and no frame is empty. AnimatePresence in
  // mode="wait" could not do it here: the exiting child was the same router
  // slot, so the new study painted at opacity 1, faded out over 160ms, left the
  // panel empty, then faded back in. Adjusting state during render is React's
  // documented pattern for derived state; the DOM copy itself is taken by the
  // layout-effect cleanup below, which runs while the old view is still painted.
  if (view.key !== pathname) {
    setView({ key: pathname, node: children });
    setEnteringKey(pathname);
  }

  // Freeze the view that is about to go. A layout-effect cleanup runs before
  // React mutates the DOM for the next commit, so this is the last moment the
  // view on screen is still the old one — and the only moment a copy of it can
  // be taken (the page under this layout is a router slot, so re-rendering its
  // element would paint the new route instead).
  useLayoutEffect(() => {
    const element = viewRef.current;
    if (!element) return;

    return () => {
      // Same route means the drawer itself is going; there is no second view to
      // fade against.
      if (window.location.pathname === view.key) return;

      exitRef.current = { key: view.key, copy: snapshotElement(element) };
      if (exitRef.current.copy) {
        copyScrollOffsets(element, exitRef.current.copy);
      }
    };
  }, [view.key]);

  // The copy is placed after the commit and fades out on its own clock; the
  // incoming view's fade is the `data-enter` animation in the stylesheet.
  useLayoutEffect(() => {
    const exit = exitRef.current;
    exitRef.current = null;

    const stack = stackRef.current;
    const copy = exit?.copy;

    if (!stack || !copy) return;

    copy.setAttribute("data-leave", "");
    stack.append(copy);

    const fade = copy.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "forwards",
    });

    const done = () => copy.remove();
    const timer = window.setTimeout(done, 600);

    void fade.finished.then(done, done);

    return () => {
      window.clearTimeout(timer);
      fade.cancel();
      done();
    };
  }, [view.key]);

  // Esc, the backdrop and the logo are one gesture. Under A they close the
  // drawer from anywhere; under B a project steps back to the index first, and
  // a second press closes it.
  const requestExit = useCallback(() => {
    if (closeBehaviour === "b" && !onIndex) stepBack();
    else void close();
  }, [close, closeBehaviour, onIndex, stepBack]);

  useEscToClose(requestExit);
  useEffect(() => registerReaderClose(close), [close]);

  useOverlayBehaviour(panelRef, {
    // The homepage goes inert once the morph has landed, not as it starts:
    // inertness is inherited, so flagging `main` restyles every homepage
    // element (~50ms at 4x CPU), and that belongs after the morph's first
    // frames. The focus trap and the backdrop hold keys and clicks meanwhile.
    lockHome: phase === "open" || reduce,
    covered: phase === "open",
    // Focus goes back to what the drawer grew out of: the card it opened from,
    // or the nav's Work item when it opened on the index. The page the drawer
    // grew out of can be replaced (or kept hidden) by the route change itself,
    // so the return is one frame late and falls back to the same study's card on
    // the page that is back, then to the nav — never the body.
    returnFocus: () => {
      const origin = originRef.current;

      requestAnimationFrame(() => {
        // Development Strict Mode runs this cleanup once on mount, with the
        // drawer still on screen; only a drawer that has really left gives
        // focus back. A closed drawer is kept, hidden, by the router, and the
        // Back exit's copy is only a picture of one.
        const onScreen = [
          ...document.querySelectorAll(
            ".wd-expand-layer:not([data-exit-ghost])",
          ),
        ].some((layer) => layer.getClientRects().length > 0);

        if (onScreen) return;

        const target =
          (origin && laidOut(origin) ? origin : null) ??
          (slug ? visibleCard(slug) : null) ??
          capsuleElement() ??
          document.querySelector<HTMLElement>(
            `${DOCK_SELECTOR} a[aria-label="Home"]`,
          );

        target?.focus({ preventScroll: true });
      });
    },
  });

  // The content's first heading takes focus when the drawer lands, and again
  // whenever the content swaps, so a keyboard user is never left on a node that
  // has just been unmounted (the outgoing copy is inert and about to go).
  const focusTitle = useCallback(() => {
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(`#${titleId}`)
        ?.focus({ preventScroll: true });
    });
  }, [panelRef, titleId]);

  useEffect(() => {
    if (phase !== "open") return;

    focusTitle();
  }, [focusTitle, phase, view.key]);

  return (
    <div
      className="wd-expand-layer"
      data-phase={phase}
      data-reveal={reveal}
      data-view={onIndex ? "index" : "study"}
      // Prototype state, visible to the switcher (and to a reviewer's DOM
      // inspector) while Dat compares A and B.
      data-close-mode={closeBehaviour}
    >
      <div
        className="wd-expand-backdrop"
        aria-hidden="true"
        onClick={requestExit}
      />

      <div className="wd-expand-content" inert={phase !== "open"}>
        <div
          ref={panelRef}
          className="wd-reader-panel"
          data-mode="overlay"
          role="dialog"
          // Deliberately not aria-modal: the one nav lives in the root layout,
          // at this panel's sibling, and must stay in the accessibility tree.
          // The homepage is inert and the focus trap holds, so the dialog is
          // modal in behaviour without telling screen readers to hide it.
          aria-labelledby={titleId}
        >
          <DrawerActionsProvider close={close} stepBack={stepBack}>
            <div className="wd-drawer-stack" ref={stackRef}>
              <div
                key={view.key}
                ref={viewRef}
                className="wd-drawer-view"
                data-enter={enteringKey === view.key ? "" : undefined}
                onAnimationEnd={(event) => {
                  if (event.animationName !== "wd-view-in") return;

                  setEnteringKey((key) => (key === view.key ? null : key));
                }}
              >
                {view.node}
              </div>
            </div>
          </DrawerActionsProvider>
        </div>
      </div>
    </div>
  );
}
