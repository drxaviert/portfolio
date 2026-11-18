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
} from "./morph";
import type { Box } from "./morph";
import {
  CAROUSEL_CLOSE_EASE,
  CAROUSEL_CLOSE_S,
  CAROUSEL_EASE,
  CAROUSEL_OPEN_S,
} from "./carousel-step";
import {
  announceOverlayClosing,
  announceOverlayExit,
  announceOverlayOpened,
} from "./overlay-exit";
import {
  clearProgressionEntry,
  isDrawerOpen,
  leaveDrawer,
  peekProgressionEntry,
} from "./progression";
import { moveNav, registerDockAnimate } from "@/components/nav/nav-flight";
import type { NavFlightTiming } from "@/components/nav/nav-flight";
import { FEATURED_SLUG } from "@/lib/work-order";

/**
 * The dock's flights run on this module's motion, so it lends the function
 * before any of them can start. Keeping the import here — rather than in
 * nav-dock.tsx — is what keeps motion out of the home route's first-load JS.
 */
registerDockAnimate(animate);

export type MorphPhase = "opening" | "open" | "closing";

/** Content entrance: held while the panel morphs, released before it lands. */
export type RevealState = "pending" | "on";

type Morph = ReturnType<typeof animate>;

export const FADE_S = 0.12;
/**
 * The content entrance starts this long before the panel lands, so reading does
 * not wait for the flight: 300ms into the 900ms open.
 */
const REVEAL_LEAD_S = 0.3;

/**
 * The drawer's motion, timed once. The shape never changes - the panel FLIPs out
 * of the card, the content rises and defocuses, the nav flies between its two
 * rows - and every part runs on the home carousel's step (carousel-step.ts): the
 * open on its 900ms curve, the close on the run it gives an interrupted step.
 * The nav is handed the same pair (nav-flight.ts) so it cannot drift from the
 * panel.
 */
const OPEN_TIMING: NavFlightTiming = {
  duration: CAROUSEL_OPEN_S,
  ease: CAROUSEL_EASE,
};
const CLOSE_TIMING: NavFlightTiming = {
  duration: CAROUSEL_CLOSE_S,
  ease: CAROUSEL_CLOSE_EASE,
};

export function cardSelector(slug: string): string {
  return `[data-work-card="${slug}"]`;
}

/**
 * The card element for a study. Several copies can exist (the stacked card, the
 * carousel's cards); only the one that is laid out (display: none has no box)
 * is the source a user saw and can return to.
 */
export function cardElement(slug: string): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  );

  return (
    candidates.find((candidate) => candidate.getClientRects().length > 0) ??
    candidates[0] ??
    null
  );
}

/** The source card, measured now. Close calls this again for the live rect. */
export function findCard(slug: string): Box | null {
  const card = cardElement(slug);

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
): {
  phase: MorphPhase;
  reveal: RevealState;
  /** This mount joined an open drawer: the panel is in place, only the content is new. */
  handoff: boolean;
  close: () => Promise<void>;
} {
  const resting = options.resting ?? false;
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const openTiming = OPEN_TIMING;
  const closeTiming = CLOSE_TIMING;
  // A study -> study mount is the same drawer: its panel is already open and
  // the new article takes the open entrance from the first frame. Read once,
  // before the first paint, because the layer's backdrop must not re-fade.
  const [handoff] = useState(() => {
    if (resting) return null;

    const announced = peekProgressionEntry();
    if (announced) return announced;

    // A Back/Forward swaps the route without a click to announce it: if a
    // drawer was already open, its replacement joins it.
    return isDrawerOpen() ? { depth: null } : null;
  });
  const entering = handoff !== null;
  const [phase, setPhase] = useState<MorphPhase>(
    resting || entering ? "open" : "opening",
  );
  const [reveal, setReveal] = useState<RevealState>(resting ? "on" : "pending");
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
      // How many studies sit on top of the entry the drawer was opened from.
      // Close needs it to land on that entry in one step, not on the study
      // behind it.
      const restoredDepth = window.history.state?.workDepth;
      const depth =
        handoff?.depth ??
        (typeof restoredDepth === "number" ? restoredDepth : 0);

      document.documentElement.dataset.drawerOrigin = origin;
      window.history.replaceState(
        {
          ...window.history.state,
          workOverlay: true,
          workOrigin: origin,
          workDepth: depth,
        },
        "",
      );
    }

    // The same drawer, showing another study. There is no card to fly out of
    // and nothing to measure: the panel, its shadow, the backdrop and the nav
    // stay exactly where they are. Only the content changes, and it takes the
    // open's own entrance. The release waits for a painted `pending` frame: the
    // blocks animate from their keyframes either way, but the ruler is a CSS
    // transition and a brand-new element has no before-change style to leave.
    if (handoff) {
      clearProgressionEntry();

      // Two frames, not one: the first paints `pending`, the second starts the
      // entrance from it. The guard is a mounted check, not a cancel in the
      // effect cleanup - development StrictMode runs that cleanup once on mount
      // and would cancel the frame the reveal is waiting on.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (mountedRef.current) settle();
        });
      });

      return;
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

    const openSeconds = openTiming.duration;

    // The content starts arriving under the landing panel rather than after
    // it, so the reader is readable at the moment the flight ends.
    const releaseContent = () => {
      revealTimerRef.current = window.setTimeout(
        () => {
          if (mountedRef.current) setReveal("on");
        },
        (openSeconds - REVEAL_LEAD_S) * 1000,
      );
    };

    // The one open: the panel FLIPs out of the card it was opened from.
    const layout = layoutBox(panel);

    setPose(panel, flipFrom(card, layout));

    const morph = animate(
      panel,
      { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      openTiming,
    );
    openingRef.current = morph;
    void morph.finished.then(settle);

    // The nav is the same element on both sides: it flies from the homepage row
    // into the panel's row with the morph, on the drawer's own timing.
    void moveNav("reader", "flip", openTiming);

    releaseContent();
  }, [slug, reduce, resting, panelRef, settle, openTiming, handoff]);

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
      leaveDrawer();
      setPhase("closing");
      openingRef.current?.stop();
      // The card measured below must be at rest: the homepage behind puts itself
      // back now, while the panel still covers it.
      announceOverlayClosing();

      const panel = panelRef.current;
      if (!panel) return;

      // The drawer keeps its one surface, but the card it closes into is the
      // study on screen now: that is where the reader was. Only when this study
      // has no card on the homepage (the carousel renders the current step, so
      // a study reached by "Next project" usually has none) does it fall back to
      // the card the drawer was opened from.
      const origin = document.documentElement.dataset.drawerOrigin ?? slug;
      const card = findCard(slug) ?? findCard(origin);

      // The nav returns on the same timing as whatever the panel does: the
      // close flight, or the 120ms fade. Both waits are capped at that timing
      // (morph.ts) so a stopped frame loop cannot strand the reader over a blank
      // page: the route change is the promise that matters.
      const exitSeconds = reduce ? FADE_S : closeTiming.duration;
      const navHome = landWithin(
        reduce ? moveNav("home", "fade") : moveNav("home", "flip", closeTiming),
        exitSeconds,
      );

      if (reduce) {
        await Promise.all([
          landWithin(
            animate(
              panel,
              { opacity: 0 },
              { duration: FADE_S, ease: "easeOut" },
            ).finished,
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
          landWithin(animate(panel, pose, closeTiming).finished, exitSeconds),
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
            animate(panel, { opacity: 0, scale: CLOSE_SCALE }, closeTiming)
              .finished,
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
      if (window.history.state?.workOverlay) {
        // Each "Next project" pushed its own entry, so the homepage is `depth`
        // studies behind this one. Land on it in one step: router.back() would
        // only reach the previous study and reopen the drawer there.
        const depth = window.history.state?.workDepth;

        if (typeof depth === "number" && depth > 0) {
          window.history.go(-(depth + 1));
        } else {
          router.back();
        }
      } else {
        delete document.documentElement.dataset.readerEntry;
        router.replace("/");
      }
    })();

    return closingRef.current;
  }, [slug, reduce, closeTiming, panelRef, router, setPhase, clearRevealTimer]);

  return { phase, reveal, handoff: entering, close };
}
