"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { registerReaderClose } from "@/components/nav/nav-flight";
import { DrawerActionsProvider, useEscToClose } from "./drawer-actions";
import { READER_TITLE_ID } from "./parts";
import { useCloseBehaviour } from "./proto-layout-toggle";
import { capsuleElement, cardElement, useDrawerMorph } from "./use-morph";
import { useOverlayBehaviour } from "./use-overlay-behaviour";
import { INDEX_TITLE_ID } from "./work-index";
import "./drawer-shell.css";

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
    // the page that is back, then to the nav.
    returnFocus: () => {
      const origin = originRef.current;

      requestAnimationFrame(() => {
        // Development Strict Mode runs this cleanup once on mount, with the
        // drawer still on screen; only a drawer that has really left gives
        // focus back. A closed drawer is kept, hidden, by the router.
        const onScreen = [
          ...document.querySelectorAll(".wd-expand-layer"),
        ].some((layer) => layer.getClientRects().length > 0);

        if (onScreen) return;

        if (origin && origin.getClientRects().length > 0) {
          origin.focus({ preventScroll: true });

          return;
        }

        const card = slug ? cardElement(slug) : null;
        (card ?? capsuleElement())?.focus({ preventScroll: true });
      });
    },
  });

  // The content's first heading takes focus when the drawer lands, and again
  // whenever the content swaps, so a keyboard user is never left on a node that
  // has just been unmounted.
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
  }, [focusTitle, phase]);

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
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={focusTitle}
            >
              <motion.div
                key={pathname}
                className="wd-drawer-view"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] },
                }}
                exit={{
                  // Out quicker than in: the old content is on its way out and
                  // the new one has the room. Opacity only — the panel never
                  // moves, and reduced motion keeps this same fade.
                  opacity: 0,
                  transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </DrawerActionsProvider>
        </div>
      </div>
    </div>
  );
}
