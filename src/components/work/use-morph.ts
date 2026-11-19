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
import { readScrollOffsets, snapshotElement, writeScrollOffsets } from "./view-snapshot";

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

/**
 * The slice of the Navigation API this file uses. Chrome and Safari ship it;
 * Firefox does not, so a missing `window.navigation` simply leaves Back without
 * the reverse flight (the route still changes, as it always did).
 */
type NavigationApi = {
  addEventListener: (
    type: "navigate",
    handler: (event: NavigationEvent) => void,
  ) => void;
  removeEventListener: (
    type: "navigate",
    handler: (event: NavigationEvent) => void,
  ) => void;
};

type NavigationEvent = {
  navigationType: string;
  canIntercept: boolean;
  destination: { url: string };
  intercept: (options: { handler: () => Promise<void> }) => void;
};


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

/**
 * How long a copy may stay on screen when the frame loop stalls: the close
 * flight plus a frame of slack.
 */
const CLOSE_CAP_MS = CAROUSEL_CLOSE_S * 1000 + 260;

export function cardSelector(slug: string): string {
  return `[data-work-card="${slug}"]`;
}

/**
 * Whether an element is actually on screen with a box: laid out (not
 * `display: none`), not `visibility: hidden`, and not zero-sized. A card can be
 * in the DOM and painted nowhere — a resize across the stacked/carousel
 * breakpoint swaps which copy is on screen — and a 0x0 origin is a collapse to
 * a point, not a morph.
 */
export function laidOut(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  if (window.getComputedStyle(element).visibility === "hidden") return false;

  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0;
}

/**
 * The card element for a study. Several copies can exist (the stacked card, the
 * carousel's cards). The laid-out one is preferred; a no-layout DOM (jsdom, and
 * the carousel's own measuring) still gets the first copy.
 */
export function cardElement(slug: string): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  );

  return candidates.find(laidOut) ?? candidates[0] ?? null;
}

/** The card for `slug` that is on screen right now, or nothing. */
export function visibleCard(slug: string): HTMLElement | null {
  return Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  ).find(laidOut) ?? null;
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
 * Where this drawer opened from: the study's card, or the nav's "Work" capsule
 * when the drawer opened on the index. Only an element with a box counts — a
 * hidden copy of the card is not somewhere a morph can land — and a study with
 * no card on screen still leaves from the capsule: the drawer came from
 * somewhere on screen, and the nav is what the visitor touched.
 */
export function findOrigin(slug: string | null): HTMLElement | null {
  if (slug) {
    const card = visibleCard(slug);
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
  const slugRef = useRef(slug);
  /** What the route before this entry in the drawer was. */
  const previousKindRef = useRef<"index" | "study" | null>(null);
  /**
   * The `/work*` tree is hidden, not unmounted, when the route leaves it, and
   * shown again on the next entry with its state intact. This flags that the
   * tree has been away, so the shell can re-arm instead of coming back shut.
   */
  const leftRef = useRef(false);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

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

  /**
   * The cleanup every run of the open effect must leave behind: the router
   * hides this tree (instead of unmounting it) when the route leaves `/work*`,
   * and that is where the shell learns it has been away. Registered on every
   * return path, because a resting direct load still leaves and comes back.
   */
  const watchForHide = useCallback(
    () => () => {
      if (!window.location.pathname.startsWith("/work")) leftRef.current = true;
    },
    [],
  );

  // Measure once, before the first paint, then animate from the origin to the
  // panel's own layout box. Nothing here reads geometry after the morph.
  useLayoutEffect(() => {
    // A hidden `/work` tree is shown again on the next entry with this same
    // component instance, state and refs intact: the shell closed on the way
    // out, so without this it would come back posed at its origin, invisible,
    // with the homepage still scroll-locked. Re-arm it and run the open again,
    // from whatever was clicked this time.
    const reentered = leftRef.current;
    leftRef.current = false;

    if (reentered) {
      const panel = panelRef.current;

      // The close left the panel transparent and posed on its origin; its
      // inline styles would keep it there.
      panel?.style.removeProperty("opacity");
      panel?.style.removeProperty("transform");

      closedRef.current = false;
      closingRef.current = null;
      openingRef.current = null;
      startedRef.current = false;
      clearRevealTimer();

      // The new entry starts with none of the last one's history: no push was
      // made inside it yet, and the last route is not behind it.
      poppedRef.current = false;
      previousKindRef.current = null;
      routeRef.current = route;
      slugRef.current = slug;

      setReveal("pending");
      setPhase("opening");
    }

    if (startedRef.current) return watchForHide();
    startedRef.current = true;

    // The entry knows whether the app pushed it. A pushed entry is closed by
    // stepping back through history; a document load is replaced by "/".
    inAppRef.current = window.history.state?.workOverlay === true;
    depthRef.current = readDepth();
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
    // close replaces this entry instead of going back through history. A
    // re-entry is a client navigation even when the tree first arrived on a
    // document load, so it takes the opening path below.
    if (resting && !reentered) {
      // The homepage is mounted underneath and must be resting: mark the
      // document before this commit paints, so its entrance never runs.
      document.documentElement.dataset.entrancePlayed = "true";
      // Match the state a settled open morph leaves behind. The FLIP pose is
      // measured from the panel's top-left corner, so a panel carrying the CSS
      // default origin would shrink from its centre and land in the wrong place.
      panelRef.current?.style.setProperty("transform-origin", "left top");
      return watchForHide();
    }

    const panel = panelRef.current;
    if (!panel) return watchForHide();

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
      return watchForHide();
    }

    // Nothing on screen to grow out of (no card, no nav): the panel is already
    // the destination, so it keeps its opaque surface and only the content is
    // new. A fade here would show the homepage through the drawer.
    if (!origin || !laidOut(origin)) {
      settle();
      return watchForHide();
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

    return watchForHide();
  }, [onIndex, panelRef, reduce, resting, settle, slug, route, clearRevealTimer, watchForHide]);

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
  // Forward restores the entry's own depth instead. Each entry also records
  // what the entry *behind* it is, so a step back only uses history when the
  // index is genuinely what Back would land on.
  useEffect(() => {
    if (routeRef.current === route) return;

    const previous: "index" | "study" =
      routeRef.current === "/work" ? "index" : "study";

    routeRef.current = route;
    previousKindRef.current = previous;

    if (poppedRef.current) {
      poppedRef.current = false;
      depthRef.current = readDepth();
      previousKindRef.current = window.history.state?.workPrev ?? null;
    } else {
      depthRef.current += 1;
    }

    if (!inAppRef.current) return;

    window.history.replaceState(
      {
        ...window.history.state,
        workOverlay: true,
        workDepth: depthRef.current,
        workPrev: previous,
      },
      "",
    );
  }, [route]);

  useEffect(() => {
    function onPopState() {
      poppedRef.current = true;
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // (The Back exit is registered below, once `originBox` exists.)


  /**
   * From a project to the index. Only an entry whose own previous entry is the
   * index can step back to it with history; after "Next project" the entry
   * behind is another study, so Back would land there instead of on the index —
   * the index is pushed in that case. The same rule serves Esc and the backdrop
   * under close=B: they call this.
   */
  const stepBack = useCallback(() => {
    if (!window.location.pathname.startsWith("/work/")) return;

    if (window.history.state?.workPrev === "index") router.back();
    else router.push("/work");
  }, [router]);

  /**
   * The live box of what the drawer grew out of, resolved again at close. The
   * element recorded at open may have gone, or been hidden by a resize across
   * the stacked/carousel breakpoint; a card that is on screen now wins, then the
   * nav's capsule. Nothing means the close takes the scale-and-fade path rather
   * than collapsing the panel into a zero-size point.
   */
  const originBox = useCallback((): Box | null => {
    const stored = originRef.current;

    if (stored && laidOut(stored)) {
      return originKindRef.current === "capsule"
        ? capsuleBox()
        : toBox(stored.getBoundingClientRect());
    }

    const again = findOrigin(slugRef.current);
    if (!again || !laidOut(again)) return null;

    const box =
      again === capsuleElement()
        ? capsuleBox()
        : toBox(again.getBoundingClientRect());

    return box && box.width > 0 && box.height > 0 ? box : null;
  }, []);

  /**
   * Browser Back out of the drawer. The router owns the commit — by the time a
   * popstate lands the URL has already left `/work*` and React is about to
   * unmount the panel — so the reverse morph runs on a copy: the layer is
   * cloned while it is still on screen, the copy flies to the origin (or fades
   * and shrinks when there is none), and the real tree goes as it must.
   *
   * Resolves when the copy is gone (or at the cap), so a Navigation API
   * interception can hold the route until the flight has played.
   */
  const playBackExit = useCallback((): Promise<void> => {
    if (closedRef.current || closingRef.current) return Promise.resolve();

    const panel = panelRef.current;
    const layer = panel?.closest<HTMLElement>(".wd-expand-layer");
    if (!panel || !layer || layer.dataset.exitGhost !== undefined) {
      return Promise.resolve();
    }

    const copy = snapshotElement(layer);
    const copyPanel = copy.querySelector<HTMLElement>(".wd-reader-panel");
    if (!copyPanel) return Promise.resolve();

    // Same order as the content swap: read while the source is still laid out,
    // write after the copy is in the document, or the write clamps to 0.
    const scroll = readScrollOffsets(layer);

    copy.setAttribute("data-exit-ghost", "");
    // The copy keeps the closing phase so the backdrop fades on its own rule,
    // and it must not catch a click while it is only a picture of the drawer.
    copy.dataset.phase = "closing";
    copy.style.pointerEvents = "none";
    document.body.append(copy);
    writeScrollOffsets(copy, scroll);

    let finish: () => void = () => undefined;
    const gone = new Promise<void>((resolve) => {
      finish = () => {
        window.clearTimeout(cap);
        resolve();
      };
    });
    const remove = () => {
      copy.remove();
      finish();
    };
    const cap = window.setTimeout(remove, CLOSE_CAP_MS);

    if (reduce) {
      void animate(
        copyPanel,
        { opacity: 0 },
        { duration: FADE_S, ease: "easeOut" },
      )
        .finished.then(remove, remove)
        .catch(() => undefined);

      return gone;
    }

    const box = originBox();

    if (box) {
      copyPanel.style.transformOrigin = "left top";
      void animate(
        copyPanel,
        flipFrom(box, layoutBox(copyPanel)),
        CLOSE_TIMING,
      )
        .finished.then(remove, remove)
        .catch(() => undefined);

      return gone;
    }

    copyPanel.style.transformOrigin = visibleCentre(
      copyPanel.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    );
    void animate(copyPanel, { opacity: 0, scale: CLOSE_SCALE }, CLOSE_TIMING)
      .finished.then(remove, remove)
      .catch(() => undefined);

    return gone;
  }, [originBox, panelRef, reduce]);

  // The exit on Back is intercepted with the Navigation API, because a popstate
  // listener cannot do it: Next's own listener runs first in the same dispatch
  // and unmounts the drawer, which removes ours before the browser reaches it
  // (the DOM spec skips listeners removed mid-dispatch). Intercepting a
  // traversal holds the URL and the commit until the copy has flown, then the
  // browser updates history and the router takes over as usual.
  useEffect(() => {
    const navigation = (window as unknown as { navigation?: NavigationApi })
      .navigation;

    if (!navigation) return;

    function onNavigate(event: NavigationEvent) {
      if (event.navigationType !== "traverse" || !event.canIntercept) return;

      const destination = new URL(event.destination.url);
      if (destination.pathname.startsWith("/work")) return;

      const exit = playBackExit();
      event.intercept({ handler: () => exit });
    }

    navigation.addEventListener("navigate", onNavigate);

    return () => navigation.removeEventListener("navigate", onNavigate);
  }, [playBackExit]);

  useEffect(() => {
    function onPopState() {
      poppedRef.current = true;
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
      // offset has to be read while the nav is still there. The origin is
      // re-checked now, not trusted from the open: a resize can hide the copy
      // that was on screen (the stacked card and the carousel swap at 768), and
      // a 0x0 origin would collapse the panel into a point.
      const box = originBox();

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
  }, [reduce, router, panelRef, clearRevealTimer, originBox]);

  return { phase, reveal, close, stepBack, originRef };
}
