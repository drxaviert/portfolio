"use client";

import { animate, releaseElement, useReducedMotion } from "motion/react";
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

/**
 * The drawer's phase. `closed` is the shell not on screen (the router hides a
 * cached tree and the phase says so); the other three are the visible states,
 * and the open/close flights are the only way between them.
 */
export type DrawerPhase = "closed" | "opening" | "open" | "closing";

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

  /** The element the drawer grew out of, for the post-close focus return. */
  const originRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);

  /** This entry's history state and what it grew out of. */
  type Entry = {
    inApp: boolean;
    depth: number;
    origin: HTMLElement | null;
    kind: "card" | "capsule" | null;
  };

  /**
   * The whole lifecycle in one place: the phase, the generation that owns it,
   * the flight that is running, the close a second close shares, the reveal
   * timer, and the entry's history and origin.
   *
   * Every transition goes through `commit`, which bumps the generation and
   * stops the running flight. An async completion commits only when its own
   * generation is still current, so an abandoned transition leaves nothing
   * behind: the new transition owns the shell from the moment it starts. The
   * phase is never a latch another transition has to clear.
   */
  type Machine = {
    phase: DrawerPhase;
    /** The router hid this tree; the next show opens a new entry. */
    hidden: boolean;
    generation: number;
    flight: Morph | null;
    closing: Promise<void> | null;
    revealTimer: number;
    entry: Entry;
  };

  const initialPhase: DrawerPhase = resting ? "open" : "closed";

  const machine = useRef<Machine>({
    phase: initialPhase,
    hidden: false,
    generation: 0,
    flight: null,
    closing: null,
    revealTimer: 0,
    entry: { inApp: false, depth: 0, origin: null, kind: null },
  });
  const [phase, setPhase] = useState<DrawerPhase>(initialPhase);
  const [reveal, setReveal] = useState<RevealState>(resting ? "on" : "pending");
  const restingRef = useRef(false);

  /** The route this entry is on, and whether the next change is Back/Forward. */
  const historyRef = useRef<{
    route: string;
    popped: boolean;
    prev: "index" | "study" | null;
  }>({ route, popped: false, prev: null });

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

  /**
   * The one transition. It owns the generation, the phase and the flight:
   * every caller that starts a new state of the shell goes through here, and
   * whatever was running is cancelled by the bump before it can commit.
   */
  const commit = useCallback(
    (next: DrawerPhase, revealNext?: RevealState) => {
      const m = machine.current;

      m.generation += 1;
      m.flight?.stop();
      m.flight = null;
      m.closing = null;

      if (m.revealTimer) {
        window.clearTimeout(m.revealTimer);
        m.revealTimer = 0;
      }

      m.phase = next;
      setPhase(next);

      if (revealNext) setReveal(revealNext);

      return m.generation;
    },
    [],
  );

  /** This entry's history state and what it grew out of. */
  const readEntry = useCallback((): Entry => {
    const inApp = window.history.state?.workOverlay === true;
    const depth = readDepth();
    const origin = findOrigin(slug);
    const kind = origin
      ? origin === capsuleElement()
        ? "capsule"
        : "card"
      : null;

    if (inApp) {
      window.history.replaceState(
        {
          ...window.history.state,
          workOverlay: true,
          workDepth: depth,
        },
        "",
      );
    }

    return { inApp, depth, origin, kind };
  }, [slug]);

  /** The open is over: the panel is at rest and the content is readable. */
  const commitOpen = useCallback(
    (generation: number) => {
      const m = machine.current;

      if (m.generation !== generation) return;

      if (m.revealTimer) {
        window.clearTimeout(m.revealTimer);
        m.revealTimer = 0;
      }

      m.flight = null;
      m.phase = "open";
      setPhase("open");
      setReveal("on");

      const panel = panelRef.current;
      panel?.style.removeProperty("transform");
      panel?.style.removeProperty("opacity");

      announceOverlayOpened();
    },
    [panelRef],
  );

  /**
   * Fly the panel to rest from `box`, under `generation`. A resume continues
   * from the box the close was showing; an entry starts from its origin.
   */
  const flyOpen = useCallback(
    (generation: number, box: Box | null, mode: "entry" | "resume") => {
      const m = machine.current;
      const panel = panelRef.current;

      if (!panel) {
        commitOpen(generation);
        return;
      }

      // Motion caches the transform values it last rendered on this element.
      // A pose written straight to the style - and a close that ran on a ghost
      // never touched this cache - is invisible to that cache, so the next
      // animation can read identity, treat the target as a no-op and settle in
      // a frame. Detach it so the flight reads the DOM again.
      releaseElement(panel);

      if (reduce) {
        // A resumed close is already visible; do not blank it to fade it back.
        if (mode === "entry") panel.style.opacity = "0";

        const flight = animate(
          panel,
          { opacity: 1 },
          { duration: FADE_S, ease: "easeOut" },
        );
        m.flight = flight;
        void flight.finished.then(() => commitOpen(generation));
        void moveNav("reader", "fade");
        return;
      }

      if (!box) {
        commitOpen(generation);
        return;
      }

      if (mode === "entry") {
        // The content starts arriving under the landing panel rather than after
        // it, so the drawer is readable at the moment the flight ends.
        m.revealTimer = window.setTimeout(
          () => {
            if (m.generation === generation && mountedRef.current) {
              setReveal("on");
            }
          },
          (OPEN_TIMING.duration - REVEAL_LEAD_S) * 1000,
        );
      } else {
        setReveal("on");
      }

      setPose(panel, flipFrom(box, layoutBox(panel)));

      const flight = animate(
        panel,
        { x: 0, y: 0, scaleX: 1, scaleY: 1 },
        OPEN_TIMING,
      );
      m.flight = flight;
      void flight.finished.then(() => commitOpen(generation));

      // The nav is the same element on both sides: it flies from the homepage
      // row into the drawer's row with the morph, on the drawer's own timing.
      void moveNav("reader", "flip", OPEN_TIMING);
    },
    [panelRef, reduce, commitOpen],
  );

  /**
   * Open this entry. `resume` is a close the visitor interrupted: the panel
   * grows from the box it is showing, and the content stays. `entry` is a
   * fresh one: it starts from whatever was clicked and its content arrives on
   * the reveal near the landing.
   */
  const enter = useCallback(
    (mode: "entry" | "resume", visual: Box | null = null) => {
      const m = machine.current;
      const entry = readEntry();
      m.hidden = false;
      m.entry = entry;
      originRef.current = entry.origin;

      // The close's inline pose (and its transparent end state) belongs to the
      // abandoned transition; this one starts from a measured box instead.
      const panel = panelRef.current;
      panel?.style.removeProperty("opacity");
      panel?.style.removeProperty("transform");

      historyRef.current.route = route;
      historyRef.current.popped = false;
      historyRef.current.prev = null;

      const generation = commit(
        "opening",
        mode === "entry" ? "pending" : "on",
      );
      const box =
        visual ??
        (entry.origin && laidOut(entry.origin)
          ? toBox(entry.origin.getBoundingClientRect())
          : null);

      flyOpen(generation, box, mode);
    },
    [commit, flyOpen, panelRef, readEntry, route],
  );

  /**
   * A new entry arrived while the shell was closing or closed (a click during
   * the close flight, a route change back into `/work*`). The generation bump
   * abandons the close; a close still flying is resumed from the panel's
   * current box, a finished one opens from this entry's origin.
   */
  const reenter = useCallback(() => {
    const m = machine.current;
    const panel = panelRef.current;
    const flying = m.phase === "closing" && m.flight !== null;

    enter(
      flying ? "resume" : "entry",
      flying && panel ? toBox(panel.getBoundingClientRect()) : null,
    );
  }, [enter, panelRef]);

  /**
   * The router hid this tree: the shell is closed until the next show opens
   * it. The tree is shown again with its state intact (React Activity keeps
   * it), so the phase has to say the shell is off screen any more.
   */
  const watchForHide = useCallback(
    () => () => {
      if (window.location.pathname.startsWith("/work")) return;

      const m = machine.current;

      // The flag is what the next show reads, synchronously: a microtask is
      // too late if the visitor is already coming back. A layout-effect cleanup
      // also runs inside React's commit, where scheduling an update is not
      // allowed, so the rendered phase catches up just after it.
      m.hidden = true;
      queueMicrotask(() => {
        if (window.location.pathname.startsWith("/work")) return;
        if (m.phase === "closed") return;

        m.phase = "closed";
        setPhase("closed");
      });
    },
    [],
  );

  /** A direct load's resting state: no flight, the homepage never enters. */
  const markResting = useCallback(() => {
    document.documentElement.dataset.entrancePlayed = "true";
    // The FLIP pose is measured from the panel's top-left corner, so a panel
    // carrying the CSS default origin would shrink from its centre and land in
    // the wrong place.
    panelRef.current?.style.setProperty("transform-origin", "left top");
  }, [panelRef]);

  // The entry itself. A hidden tree is shown with the phase saying "closed",
  // so it opens this entry; a direct load rests; StrictMode's second setup
  // finds the phase already opening.
  useLayoutEffect(() => {
    const m = machine.current;

    if (m.hidden || m.phase === "closed") {
      enter("entry");
    } else if (resting && !restingRef.current) {
      restingRef.current = true;
      m.entry = readEntry();
      originRef.current = m.entry.origin;
      markResting();
    } else if (m.phase === "open") {
      // The open can complete while the tree is hidden (a Back during the
      // flight): the panel ref is gone then, so the pose it left is settled
      // here, on the show, where an open shell means "at rest".
      const panel = panelRef.current;
      panel?.style.removeProperty("transform");
      panel?.style.removeProperty("opacity");
    }

    return watchForHide();
  }, [enter, markResting, panelRef, readEntry, resting, watchForHide]);

  // A resize mid-morph jumps to the end; after that the panel is pure CSS, so
  // the new viewport just reflows it and close measures the origin again.
  useEffect(() => {
    if (phase !== "opening") return;

    const onResize = () => machine.current.flight?.complete();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [phase]);

  // A route change while the drawer is closed or closing is a re-entry that
  // never left `/work*` (the visitor came back before the close landed): the
  // new entry opens. Otherwise it is a navigation inside the drawer: count its
  // depth and record what the entry behind it is, for stepBack.
  useEffect(() => {
    const history = historyRef.current;
    if (history.route === route) return;

    const m = machine.current;

    if (m.phase === "closing" || m.phase === "closed") {
      reenter();
      return;
    }

    const previous: "index" | "study" =
      history.route === "/work" ? "index" : "study";

    history.route = route;
    history.prev = previous;

    if (history.popped) {
      history.popped = false;
      m.entry.depth = readDepth();
      history.prev = window.history.state?.workPrev ?? null;
    } else {
      m.entry.depth += 1;
    }

    if (!m.entry.inApp) return;

    window.history.replaceState(
      {
        ...window.history.state,
        workOverlay: true,
        workDepth: m.entry.depth,
        workPrev: previous,
      },
      "",
    );
  }, [route, reenter]);

  useEffect(() => {
    function onPopState() {
      historyRef.current.popped = true;
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    const entry = machine.current.entry;

    if (entry.origin && laidOut(entry.origin)) {
      return entry.kind === "capsule"
        ? capsuleBox()
        : toBox(entry.origin.getBoundingClientRect());
    }

    const again = findOrigin(slug);
    if (!again || !laidOut(again)) return null;

    const box =
      again === capsuleElement()
        ? capsuleBox()
        : toBox(again.getBoundingClientRect());

    return box && box.width > 0 && box.height > 0 ? box : null;
  }, [slug]);

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
    const m = machine.current;
    if (m.phase !== "open" && m.phase !== "opening") return Promise.resolve();

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

  // Navigation is the route's own signal, and the only one that fires for a
  // same-URL push (clicking Work while already on /work), which never changes
  // the pathname. A traversal leaving /work* flies the ghost; a navigation
  // into /work* while the drawer is not open is the visitor coming back.
  useEffect(() => {
    const navigation = (window as unknown as { navigation?: NavigationApi })
      .navigation;

    if (!navigation) return;

    function onNavigate(event: NavigationEvent) {
      const destination = new URL(event.destination.url);
      const m = machine.current;

      if (!destination.pathname.startsWith("/work")) {
        if (event.navigationType !== "traverse" || !event.canIntercept) return;

        const exit = playBackExit();
        event.intercept({ handler: () => exit });
        return;
      }

      if (m.phase === "opening" || m.phase === "open") return;

      // A different /work route re-renders the shell and the route effect
      // opens that entry; a same-URL push fires no route change at all, so it
      // is handled here. The event runs inside the router's own history write
      // (Next syncs history from an insertion effect), where a React update is
      // not allowed: let the commit finish first.
      if (destination.pathname !== window.location.pathname) return;

      queueMicrotask(() => {
        const current = machine.current;
        if (current.phase === "opening" || current.phase === "open") return;
        if (!window.location.pathname.startsWith("/work")) return;

        reenter();
      });
    }

    navigation.addEventListener("navigate", onNavigate);

    return () => navigation.removeEventListener("navigate", onNavigate);
  }, [playBackExit, reenter]);

  /**
   * Play the reverse morph, then ask the route to leave. There is no closed
   * latch: the hide closes the shell, and a navigation back into /work*
   * reopens it. A close whose navigation is superseded is simply abandoned by
   * the next transition's generation.
   */
  const close = useCallback(() => {
    const m = machine.current;

    if (m.closing) return m.closing;
    // A hidden shell cannot close: it is not on screen, and the next show opens
    // the new entry. (Its effects are unmounted, so nothing can call this, but
    // the state machine should not depend on that.)
    if (m.hidden) return Promise.resolve();
    if (m.phase !== "opening" && m.phase !== "open") return Promise.resolve();

    const generation = commit("closing");
    announceOverlayClosing();

    const panel = panelRef.current;
    const box = originBox();

    // The nav returns on the same timing as whatever the panel does: the close
    // flight, or the 120ms fade. Both waits are capped at that timing (morph.ts)
    // so a stopped frame loop cannot strand the drawer over a blank page: the
    // route change is the promise that matters.
    const exitSeconds = reduce ? FADE_S : CLOSE_TIMING.duration;
    const navHome = landWithin(
      reduce ? moveNav("home", "fade") : moveNav("home", "flip", CLOSE_TIMING),
      exitSeconds,
    );

    const closing = (async () => {
      if (!panel) return;

      if (reduce) {
        m.flight = animate(panel, { opacity: 0 }, {
          duration: FADE_S,
          ease: "easeOut",
        });
      } else if (box) {
        // The pose maps the panel's top-left corner onto the origin's: the
        // origin must be that corner whatever state the panel was opened in.
        panel.style.transformOrigin = "left top";
        m.flight = animate(panel, flipFrom(box, layoutBox(panel)), CLOSE_TIMING);
      } else {
        // Nothing to land on: the close flight still runs, shrinking in place
        // about the centre of what is actually on screen.
        panel.style.transformOrigin = visibleCentre(
          panel.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
        );
        m.flight = animate(
          panel,
          { opacity: 0, scale: CLOSE_SCALE },
          CLOSE_TIMING,
        );
      }

      const flight = m.flight;
      await Promise.all([landWithin(flight.finished, exitSeconds), navHome]);

      // A transition started while this flight ran (a reopen, a new entry):
      // it owns the shell now, so this close must not touch the pose or the
      // route.
      if (m.generation !== generation) return;

      m.flight = null;
      panel.style.removeProperty("transform");
      panel.style.opacity = "0";

      // Ask the route to leave. Its outcome owns the phase: leaving hides the
      // tree (closed), and a superseding navigation into /work* reopens it.
      if (!window.location.pathname.startsWith("/work")) return;

      // The in-app drawer steps back to the homepage entry in one go: every
      // navigation inside it pushed its own entry above that one. A direct load
      // is the document's own entry and is replaced instead, so Back cannot
      // reopen the drawer.
      if (!m.entry.inApp) {
        router.replace("/");
      } else if (m.entry.depth > 0) {
        window.history.go(-(m.entry.depth + 1));
      } else {
        router.back();
      }
    })();

    m.closing = closing;

    return closing;
  }, [commit, originBox, panelRef, reduce, router]);

  return { phase, reveal, close, stepBack, originRef };
}
