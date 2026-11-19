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
  announceOverlayOpened,
} from "./overlay-exit";
import { DOCK_SELECTOR, SLOT_SELECTOR, moveNav, registerDockAnimate } from "@/components/nav/nav-flight";
import type { NavFlightTiming } from "@/components/nav/nav-flight";

/**
 * The one drawer over every `/work*` URL: the panel, its backdrop and its two
 * flights.
 *
 * Mounted once (the intercepted slot keys the drawer constantly), so the panel
 * never remounts: a study, another study and the index are all the same panel,
 * and only its content changes. The morph is therefore an opening and a closing
 * and nothing else.
 *
 * The dock's flights run on this module's motion, so it lends the function
 * before any of them can start. Keeping the import here — rather than in
 * nav-dock.tsx — is what keeps motion out of the home route's first-load JS.
 */
registerDockAnimate(animate);

export type DrawerPhase = "opening" | "open" | "closing";

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
 * of its origin, the content is revealed near the landing, the nav flies between
 * its two rows - and every part runs on the home carousel's step
 * (carousel-step.ts): the open on its 900ms curve, the close on the run it gives
 * an interrupted step. The nav is handed the same pair (nav-flight.ts) so it
 * cannot drift from the panel.
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
 * is an origin a user saw and can return to.
 */
export function cardElement(slug: string): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  );

  return (
    candidates.find(
      (candidate) =>
        candidate.getClientRects().length > 0 &&
        window.getComputedStyle(candidate).visibility !== "hidden",
    ) ??
    candidates[0] ??
    null
  );
}

/** The nav's "Work" capsule: the drawer's origin when it opens on the index. */
export function capsuleElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `${DOCK_SELECTOR} a[aria-label="Work"]`,
  );
}

/**
 * The capsule's box as it sits on the homepage, not as it sits in the drawer.
 * While the drawer is open the nav has flown into its top row, so the capsule's
 * live rect is far from the slot it came from; the dock's own home slot gives
 * the offset back, and a close then lands where the nav will be once it has
 * flown home.
 */
export function capsuleBox(): Box | null {
  const capsule = capsuleElement();
  if (!capsule) return null;

  const box = toBox(capsule.getBoundingClientRect());
  const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR);
  const slot = document.querySelector<HTMLElement>(SLOT_SELECTOR);

  if (!dock || !slot) return box;

  const home = slot.getBoundingClientRect().top - dock.getBoundingClientRect().top;

  return home === 0 ? box : { ...box, top: box.top + home };
}

/**
 * Where this drawer opened from, measured once: the study's card, or the nav's
 * "Work" capsule when the drawer opened on the index. A study with no card on
 * the homepage still leaves from the capsule: the drawer came from somewhere on
 * screen, and the nav is what the visitor touched.
 */
export function findOrigin(slug: string | null): HTMLElement | null {
  if (slug) {
    const card = cardElement(slug);
    if (card) return card;
  }

  return capsuleElement();
}

/** The source element, measured now. Close calls this again for the live rect. */
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

/** The history depth of the drawer's current entry, when it carries one. */
function readDepth(): number {
  const depth = window.history.state?.workDepth;

  return typeof depth === "number" ? depth : 0;
}

export function useDrawerMorph(
  panelRef: { current: HTMLElement | null },
  options: {
    /** The study on screen; null on the index. */
    slug: string | null;
    /** The pathname: a change inside the drawer is one more history entry. */
    route: string;
    /**
     * A direct load: the drawer is already the destination, so it starts in its
     * open resting state with no morph, and the entry is not the in-app overlay
     * (closing replaces it instead of stepping back through history).
     */
    resting?: boolean;
  },
): {
  phase: DrawerPhase;
  reveal: RevealState;
  close: () => Promise<void>;
  stepBack: () => void;
  /** What the drawer opened from, for the post-close focus return. */
  originRef: RefObject<HTMLElement | null>;
} {
  const { slug, route, resting = false } = options;
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const onIndex = route === "/work";

  const [phase, setPhase] = useState<DrawerPhase>(resting ? "open" : "opening");
  const [reveal, setReveal] = useState<RevealState>(resting ? "on" : "pending");
  const originRef = useRef<HTMLElement | null>(null);
  /** Whether the drawer grew out of a study's card or the nav's capsule. */
  const originKindRef = useRef<"card" | "capsule" | null>(null);
  const openingRef = useRef<Morph | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  const closingRef = useRef<Promise<void> | null>(null);
  const revealTimerRef = useRef(0);
  const mountedRef = useRef(true);
  /** Pushes made inside the drawer, above the entry it opened on. */
  const depthRef = useRef(0);
  /** The drawer's entry is the app's own navigation, not a document load. */
  const inAppRef = useRef(false);
  /** The next route change is the browser's Back/Forward, not a push. */
  const poppedRef = useRef(false);
  const routeRef = useRef(route);
  /** An index entry sits under the current project: Back reaches it. */
  const indexBehindRef = useRef(onIndex);

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
  }, [panelRef, clearRevealTimer]);

  // Measure once, before the first paint, then animate from the origin to the
  // panel's own layout box. Nothing here reads geometry after the morph.
  useLayoutEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // The entry knows whether the app pushed it. A pushed entry is closed by
    // stepping back through history; a document load is replaced by "/".
    inAppRef.current = window.history.state?.workOverlay === true;
    depthRef.current = readDepth();
    indexBehindRef.current = onIndex;
    originRef.current = findOrigin(slug);
    originKindRef.current = originRef.current
      ? originRef.current === capsuleElement()
        ? "capsule"
        : "card"
      : null;

    if (inAppRef.current) {
      window.history.replaceState(
        {
          ...window.history.state,
          workOverlay: true,
          workDepth: depthRef.current,
        },
        "",
      );
    }

    // A direct load is not an in-app overlay: there is no entry behind it, so
    // close replaces this entry instead of going back through history.
    if (resting) {
      // The homepage is mounted underneath and must be resting: mark the
      // document before this commit paints, so its entrance never runs.
      document.documentElement.dataset.entrancePlayed = "true";
      // Match the state a settled open morph leaves behind. The FLIP pose is
      // measured from the panel's top-left corner, so a panel carrying the CSS
      // default origin would shrink from its centre and land in the wrong place.
      panelRef.current?.style.setProperty("transform-origin", "left top");
      return;
    }

    const panel = panelRef.current;
    if (!panel) return;

    const origin = originRef.current;

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

    // Nothing on screen to grow out of (no card, no nav): the panel is already
    // the destination, so it keeps its opaque surface and only the content is
    // new. A fade here would show the homepage through the drawer.
    if (!origin) {
      settle();
      return;
    }

    const openSeconds = OPEN_TIMING.duration;

    // The content starts arriving under the landing panel rather than after
    // it, so the drawer is readable at the moment the flight ends.
    revealTimerRef.current = window.setTimeout(
      () => {
        if (mountedRef.current) setReveal("on");
      },
      (openSeconds - REVEAL_LEAD_S) * 1000,
    );

    // The one open: the panel FLIPs out of the element it was opened from.
    const layout = layoutBox(panel);

    setPose(panel, flipFrom(toBox(origin.getBoundingClientRect()), layout));

    const morph = animate(
      panel,
      { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      OPEN_TIMING,
    );
    openingRef.current = morph;
    void morph.finished.then(settle);

    // The nav is the same element on both sides: it flies from the homepage row
    // into the drawer's row with the morph, on the drawer's own timing.
    void moveNav("reader", "flip", OPEN_TIMING);
  }, [onIndex, panelRef, reduce, resting, settle, slug]);

  // A resize mid-morph jumps to the end; after that the panel is pure CSS, so
  // the new viewport just reflows it and close measures the origin again.
  useEffect(() => {
    if (phase !== "opening") return;

    const onResize = () => openingRef.current?.complete();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [phase]);

  // Every client navigation inside the drawer is one more entry above the one
  // it opened on, so close can reach the homepage in a single step. A Back or
  // Forward restores the entry's own depth instead.
  useEffect(() => {
    if (routeRef.current === route) return;

    routeRef.current = route;

    if (poppedRef.current) {
      poppedRef.current = false;
      depthRef.current = readDepth();
    } else {
      depthRef.current += 1;
    }

    if (onIndex) indexBehindRef.current = true;

    if (!inAppRef.current) return;

    window.history.replaceState(
      {
        ...window.history.state,
        workOverlay: true,
        workDepth: depthRef.current,
      },
      "",
    );
  }, [onIndex, route]);

  useEffect(() => {
    function onPopState() {
      poppedRef.current = true;
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /**
   * From a project to the index. The index went first when the drawer opened on
   * it (or was visited since), so Back returns to it; otherwise this pushes it,
   * and Back then returns to the project, exactly as the URL history says.
   */
  const stepBack = useCallback(() => {
    if (!window.location.pathname.startsWith("/work/")) return;

    if (indexBehindRef.current) router.back();
    else router.push("/work");
  }, [router]);

  /** Runs the reverse morph, then leaves the route. One flight at a time. */
  const close = useCallback(() => {
    if (closingRef.current) return closingRef.current;

    closingRef.current = (async () => {
      if (closedRef.current) return;

      clearRevealTimer();
      setPhase("closing");
      openingRef.current?.stop();
      announceOverlayClosing();

      const panel = panelRef.current;
      if (!panel) return;

      // Measure the origin before the nav starts its own flight: the capsule's
      // home position is derived from the dock's current (drawer) row, so the
      // offset has to be read while the nav is still there.
      const origin = originRef.current;
      const box =
        !origin || !origin.isConnected
          ? null
          : originKindRef.current === "capsule"
            ? capsuleBox()
            : toBox(origin.getBoundingClientRect());

      // The nav returns on the same timing as whatever the panel does: the
      // close flight, or the 120ms fade. Both waits are capped at that timing
      // (morph.ts) so a stopped frame loop cannot strand the drawer over a blank
      // page: the route change is the promise that matters.
      const exitSeconds = reduce ? FADE_S : CLOSE_TIMING.duration;
      const navHome = landWithin(
        reduce ? moveNav("home", "fade") : moveNav("home", "flip", CLOSE_TIMING),
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
      } else if (box) {
        // The pose maps the panel's top-left corner onto the origin's: the
        // origin must be that corner whatever state the panel was opened in.
        panel.style.transformOrigin = "left top";
        const pose = flipFrom(box, layoutBox(panel));
        await Promise.all([
          landWithin(animate(panel, pose, CLOSE_TIMING).finished, exitSeconds),
          navHome,
        ]);
      } else {
        // Nothing to land on: the close flight still runs, shrinking in place
        // about the centre of what is actually on screen.
        panel.style.transformOrigin = visibleCentre(
          panel.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
        );
        await Promise.all([
          landWithin(
            animate(panel, { opacity: 0, scale: CLOSE_SCALE }, CLOSE_TIMING)
              .finished,
            exitSeconds,
          ),
          navHome,
        ]);
      }

      closedRef.current = true;
      panel.style.removeProperty("transform");
      panel.style.opacity = "0";

      if (!window.location.pathname.startsWith("/work")) return;

      // The in-app drawer steps back to the homepage entry in one go: every
      // navigation inside it pushed its own entry above that one. A direct load
      // is the document's own entry and is replaced instead, so Back cannot
      // reopen the drawer.
      if (!inAppRef.current) {
        router.replace("/");
      } else if (depthRef.current > 0) {
        window.history.go(-(depthRef.current + 1));
      } else {
        router.back();
      }
    })();

    return closingRef.current;
  }, [reduce, router, panelRef, clearRevealTimer]);

  return { phase, reveal, close, stepBack, originRef };
}
