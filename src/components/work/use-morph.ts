"use client";

import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import {
  flipFrom,
  toBox,
  MORPH_CLOSE_S,
  MORPH_EASE,
  MORPH_OPEN_S,
} from "./morph";
import type { Box } from "./morph";
import { announceOverlayExit } from "./overlay-exit";
import { moveNav } from "@/components/nav/nav-flight";

export type MorphPhase = "opening" | "open" | "closing";

/** Content entrance: held while the panel morphs, released before it lands. */
export type RevealState = "pending" | "on";

type Morph = ReturnType<typeof animate>;

const FADE_S = 0.12;
/** The entrance starts this long before the morph lands, so reading does not wait for it. */
const REVEAL_LEAD_S = 0.12;

export function cardSelector(slug: string): string {
  return `[data-work-card="${slug}"]`;
}

/** The source card, measured now. Close calls this again for the live rect. */
export function findCard(slug: string): Box | null {
  const card = document.querySelector<HTMLElement>(cardSelector(slug));

  return card ? toBox(card.getBoundingClientRect()) : null;
}

/**
 * Whether a direct load's reader is still on screen behind the overlay. Opening
 * a study from a hard-loaded one leaves that study's page-mode reader in the
 * tree with the overlay on top, so Back from here would reveal a reader instead
 * of the homepage. Once Next parks a route it keeps the reader in the DOM with
 * `display: none`, which is not a reader the user could land on, so only a
 * rendered one counts.
 */
function pageReaderBehind(): boolean {
  const page = document.querySelector<HTMLElement>(
    '.wd-reader-panel[data-mode="page"]',
  );

  return page !== null && page.getClientRects().length > 0;
}

/**
 * The panel's untransformed layout box. `offsetLeft`/`offsetTop` ignore the
 * transform, so a close during the open morph still knows where the panel will
 * settle on screen.
 */
function layoutBox(panel: HTMLElement): Box {
  const rect = panel.getBoundingClientRect();

  return {
    left: panel.offsetLeft,
    top: panel.offsetTop,
    width: panel.offsetWidth || rect.width,
    height: panel.offsetHeight || rect.height,
  };
}

function setPose(
  panel: HTMLElement,
  pose: { x: number; y: number; scaleX: number; scaleY: number },
) {
  panel.style.transformOrigin = "top left";
  panel.style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${pose.scaleX}, ${pose.scaleY})`;
}

export function useMorph(
  slug: string,
  panelRef: RefObject<HTMLElement | null>,
): { phase: MorphPhase; reveal: RevealState; close: () => Promise<void> } {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<MorphPhase>("opening");
  const [reveal, setReveal] = useState<RevealState>("pending");
  const openingRef = useRef<Morph | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  const closingRef = useRef<Promise<void> | null>(null);
  const revealTimerRef = useRef(0);
  const mountedRef = useRef(true);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = 0;
    }
  }, []);

  // Development StrictMode re-runs effects on mount (setup, cleanup, setup).
  // The entrance timer must survive that: an earlier version cleared it in the
  // effect cleanup, so the timer was lost and the cascade only started at
  // settle - 120ms late. This guard only stops a late fire after unmount.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const settle = useCallback(() => {
    if (closedRef.current) return;

    clearRevealTimer();
    setReveal("on");

    const panel = panelRef.current;
    panel?.style.removeProperty("transform");
    panel?.style.removeProperty("opacity");

    setPhase("open");
  }, [panelRef, setPhase, clearRevealTimer]);

  // Measure once, before the first paint, then animate from the card to the
  // panel's own layout box. Nothing here reads geometry after the morph.
  useLayoutEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    window.history.replaceState(
      { ...window.history.state, workOverlay: true },
      "",
    );

    const panel = panelRef.current;
    if (!panel) return;

    const card = findCard(slug);

    if (reduce) {
      panel.style.opacity = "0";
      const fade = animate(
        panel,
        { opacity: 1 },
        { duration: FADE_S, ease: "easeOut" },
      );
      openingRef.current = fade;
      void moveNav("reader", "fade");
      void fade.finished.then(settle);
      return;
    }

    // "Next project" opens a study with no card to morph from. The panel is
    // already the destination, so it keeps its opaque surface and only the new
    // content changes: a fade here would show the homepage through the reader.
    // The nav is already in the drawer's position, so it stays put.
    if (!card) {
      settle();
      return;
    }

    const layout = layoutBox(panel);

    setPose(panel, flipFrom(card, layout));

    const morph = animate(
      panel,
      { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      { duration: MORPH_OPEN_S, ease: MORPH_EASE },
    );
    openingRef.current = morph;
    void morph.finished.then(settle);

    // The nav is the same element on both sides: it flies from the homepage
    // row into the panel's row with the morph, on the same curve.
    void moveNav("reader", "flip");

    // The content starts arriving under the landing panel rather than after
    // it, so the reader is readable at the moment the morph ends.
    revealTimerRef.current = window.setTimeout(
      () => {
        if (mountedRef.current) setReveal("on");
      },
      (MORPH_OPEN_S - REVEAL_LEAD_S) * 1000,
    );
  }, [slug, reduce, panelRef, settle]);

  // A resize mid-morph jumps to the end; after that the panel is pure CSS, so
  // the new viewport just reflows it and close measures the card again.
  useEffect(() => {
    if (phase !== "opening") return;

    const onResize = () => openingRef.current?.complete();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [phase]);

  /** Runs the reverse morph, then leaves the route. One flight at a time. */
  const close = useCallback(() => {
    if (closingRef.current) return closingRef.current;

    closingRef.current = (async () => {
      if (closedRef.current) return;

      clearRevealTimer();
      setPhase("closing");
      openingRef.current?.stop();

      const panel = panelRef.current;
      if (!panel) return;

      const card = findCard(slug);
      // The nav returns on the same timing as whatever the panel does: the
      // 300ms reverse morph, or the 120ms fade.
      const navHome = moveNav("home", card && !reduce ? "flip" : "fade");

      if (!card || reduce) {
        await Promise.all([
          animate(panel, { opacity: 0 }, { duration: FADE_S, ease: "easeOut" })
            .finished,
          navHome,
        ]);
      } else {
        const pose = flipFrom(card, layoutBox(panel));
        await Promise.all([
          animate(panel, pose, { duration: MORPH_CLOSE_S, ease: "easeIn" })
            .finished,
          navHome,
        ]);
      }

      closedRef.current = true;
      panel.style.removeProperty("transform");
      panel.style.opacity = "0";
      announceOverlayExit();

      if (window.location.pathname !== `/work/${slug}`) return;

      if (window.history.state?.workOverlay && !pageReaderBehind())
        router.back();
      else router.push("/");
    })();

    return closingRef.current;
  }, [slug, reduce, panelRef, router, setPhase, clearRevealTimer]);

  return { phase, reveal, close };
}
