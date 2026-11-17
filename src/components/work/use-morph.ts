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
  CLOSE_SCALE,
  flipFrom,
  landWithin,
  toBox,
  visibleCentre,
  MORPH_CLOSE_S,
  MORPH_EASE,
  MORPH_OPEN_S,
} from "./morph";
import type { Box } from "./morph";
import {
  announceOverlayClosing,
  announceOverlayExit,
  announceOverlayOpened,
} from "./overlay-exit";
import { moveNav } from "@/components/nav/nav-flight";
import { FEATURED_SLUG } from "@/lib/work-order";

export type MorphPhase = "opening" | "open" | "closing";

/** Content entrance: held while the panel morphs, released before it lands. */
export type RevealState = "pending" | "on";

type Morph = ReturnType<typeof animate>;

export const FADE_S = 0.12;
/**
 * The entrance starts this long before the morph lands, so reading does not
 * wait for it: 300ms into the 480ms open, which puts content on screen 180ms
 * earlier than the old 120ms lead.
 */
const REVEAL_LEAD_S = 0.3;

export function cardSelector(slug: string): string {
  return `[data-work-card="${slug}"]`;
}

/** The source card, measured now. Close calls this again for the live rect. */
export function findCard(slug: string): Box | null {
  // Below md the stacked card and the carousel card can both exist; only the
  // one that is laid out (display: none has no box) is the morph's source.
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  );
  const card =
    candidates.find((candidate) => candidate.getClientRects().length > 0) ??
    candidates[0];

  return card ? toBox(card.getBoundingClientRect()) : null;
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
  options: {
    /**
     * A direct load: the reader is already the destination, so it starts in its
     * open resting state with no morph, and the entry is not the in-app overlay
     * (closing replaces it instead of going back to a homepage entry).
     */
    resting?: boolean;
  } = {},
): { phase: MorphPhase; reveal: RevealState; close: () => Promise<void> } {
  const resting = options.resting ?? false;
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<MorphPhase>(resting ? "open" : "opening");
  const [reveal, setReveal] = useState<RevealState>(
    resting ? "on" : "pending",
  );
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
    announceOverlayOpened();
  }, [panelRef, setPhase, clearRevealTimer]);

  // Measure once, before the first paint, then animate from the card to the
  // panel's own layout box. Nothing here reads geometry after the morph.
  useLayoutEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // A direct load is not an in-app overlay: there is no homepage entry behind
    // it, so close replaces this entry instead of going back through history.
    if (resting) {
      // The homepage is mounted underneath and must be resting: mark the
      // document before this commit paints, so its entrance never runs.
      document.documentElement.dataset.entrancePlayed = "true";
      // And remember that this document's entry is the study itself, so a
      // reader opened over it (study to study) closes to '/' as well.
      document.documentElement.dataset.readerEntry = "direct";
      // Match the state a settled open morph leaves behind. The FLIP pose is
      // measured from the panel's top-left corner, so a panel carrying the CSS
      // default origin would shrink from its centre and land in the wrong place.
      panelRef.current?.style.setProperty("transform-origin", "left top");
      // The drawer is one surface: whatever study this is, it closes into a
      // card. Its own if home has one, otherwise the featured study's.
      document.documentElement.dataset.drawerOrigin = findCard(slug)
        ? slug
        : FEATURED_SLUG;
      return;
    }

    // Only an entry reached from the homepage goes back to it.
    if (document.documentElement.dataset.readerEntry !== "direct") {
      // The drawer keeps the origin it opened from across study swaps and
      // Back/Forward: a restored entry carries it in history state, a remount
      // finds it on the document, otherwise this open is the origin.
      const restored = window.history.state?.workOrigin;
      const origin =
        typeof restored === "string"
          ? restored
          : (document.documentElement.dataset.drawerOrigin ?? slug);

      document.documentElement.dataset.drawerOrigin = origin;
      window.history.replaceState(
        { ...window.history.state, workOverlay: true, workOrigin: origin },
        "",
      );
    }

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
  }, [slug, reduce, resting, panelRef, settle]);

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
      // The card measured below must be at rest: the homepage behind puts itself
      // back now, while the panel still covers it.
      announceOverlayClosing();

      const panel = panelRef.current;
      if (!panel) return;

      // The drawer is one surface: it closes into the card it was opened from,
      // whatever studies it showed on the way. The card-less exit is only for a
      // drawer whose origin card is not on screen any more.
      const origin =
        document.documentElement.dataset.drawerOrigin ?? slug;
      const card = findCard(origin);

      // The nav returns on the same timing as whatever the panel does: the
      // close flight, or the 120ms fade. Both waits are capped at that timing
      // (morph.ts) so a stopped frame loop cannot strand the reader over a blank
      // page: the route change is the promise that matters.
      const exitSeconds = reduce ? FADE_S : MORPH_CLOSE_S;
      const navHome = landWithin(moveNav("home", reduce ? "fade" : "flip"), exitSeconds);

      if (reduce) {
        await Promise.all([
          landWithin(
            animate(panel, { opacity: 0 }, { duration: FADE_S, ease: "easeOut" })
              .finished,
            exitSeconds,
          ),
          navHome,
        ]);
      } else if (card) {
        // The pose maps the panel's top-left corner onto the card's: the origin
        // must be that corner whatever state the panel was opened in.
        panel.style.transformOrigin = "left top";
        const pose = flipFrom(card, layoutBox(panel));
        await Promise.all([
          landWithin(
            animate(panel, pose, { duration: MORPH_CLOSE_S, ease: "easeIn" })
              .finished,
            exitSeconds,
          ),
          navHome,
        ]);
      } else {
        // No card to land on (a study with none, or a direct load behind):
        // the close flight still runs, shrinking in place about the centre of
        // what is actually on screen.
        panel.style.transformOrigin = visibleCentre(
          panel.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
        );
        await Promise.all([
          landWithin(
            animate(
              panel,
              { opacity: 0, scale: CLOSE_SCALE },
              { duration: MORPH_CLOSE_S, ease: "easeIn" },
            ).finished,
            exitSeconds,
          ),
          navHome,
        ]);
      }

      closedRef.current = true;
      panel.style.removeProperty("transform");
      panel.style.opacity = "0";
      announceOverlayExit();

      if (window.location.pathname !== `/work/${slug}`) return;

      // An in-app overlay leaves through the entry it was opened from (the
      // homepage); a direct load — or a reader opened over one — has no such
      // entry, so '/' replaces the study instead. Back from home must not
      // reopen the reader.
      if (window.history.state?.workOverlay) router.back();
      else {
        delete document.documentElement.dataset.readerEntry;
        router.replace("/");
      }
    })();

    return closingRef.current;
  }, [slug, reduce, panelRef, router, setPhase, clearRevealTimer]);

  return { phase, reveal, close };
}
