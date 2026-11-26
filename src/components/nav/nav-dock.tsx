"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";
import type { animate as motionAnimate } from "motion/react";
import { HomeNav } from "@/components/home/home-nav";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import {
  SLOT_SELECTOR,
  getDockAnimate,
  hasReaderClose,
  registerNavDock,
  requestReaderClose,
} from "./nav-flight";
import type {
  NavDockState,
  NavFlightMode,
  NavFlightTiming,
} from "./nav-flight";
import {
  MORPH_CLOSE_S,
  MORPH_EASE,
  MORPH_OPEN_S,
} from "@/components/work/morph";
import { NavMotionBlur, beginNavBlur, endNavBlur } from "./nav-motion-blur";
// Starts tracking keyboard navigation before the drawer's code has loaded.
import "./input-modality";
import "./nav-dock.css";

/** Half of the 120ms reduced-motion crossfade. */
const FADE_S = 0.06;
const SNAP_PX = 0.5;

/**
 * A node's top in document space from layout alone. `offsetTop` ignores
 * transforms, so the entrance's first-frame rise does not read as a position:
 * the slot is still `translate: 0 7px` when the dock first measures it.
 */
function layoutTop(node: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = node;

  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return top;
}

type Flight = ReturnType<typeof motionAnimate>;

/**
 * The homepage's nav, and the drawer's, as one element. It lives in the root
 * layout, so a soft navigation never remounts it: hover Glide, the theme
 * toggle and the phase picker keep their state when the drawer opens.
 *
 * At rest on the home route it is placed absolutely over the empty slot the
 * home layout reserves (`[data-nav-slot]`), so the page looks and scrolls
 * exactly as before. In the reader it is fixed at the panel's nav position. The
 * move between the two is a FLIP: measure where it appears, switch state,
 * compensate with a transform, then animate that transform to zero in sync with
 * the panel morph. Nothing here goes through React state per frame.
 */
export function NavDock() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const pathname = usePathname();
  // `/work` and every study in it are one drawer: the nav sits in its row for
  // all of them, and crosses that boundary once, not per URL.
  const readerRoute = pathname === "/work" || pathname.startsWith("/work/");
  // Read once: later pathname changes must not snap the nav while a flight or
  // the reader owns it. The live state is the DOM attribute, which the flights
  // write directly.
  const [initial] = useState<NavDockState>(() =>
    readerRoute ? "reader" : "home",
  );
  const stateRef = useRef<NavDockState>(initial);
  const flyingRef = useRef<Flight | null>(null);
  const alignHomeRef = useRef<(() => void) | null>(null);

  const fly = useCallback(
    async (to: NavDockState, mode: NavFlightMode, timing?: NavFlightTiming) => {
      const el = ref.current;
      if (!el) return;
      if (stateRef.current === to && !flyingRef.current) return;

      // The satellite reads this attribute, so its exit starts on the same
      // frame as the nav's return instead of waiting for the route change that
      // lands after the flight.
      if (to === "reader") {
        delete el.dataset.navLeaving;
      } else {
        el.dataset.navLeaving = "true";
      }

      // Nothing has loaded the reader in this document, so there is no motion to
      // fly with and no drawer to fly into: take the new place at once.
      const animate = getDockAnimate();
      if (!animate) {
        el.style.removeProperty("top");
        el.style.removeProperty("transform");
        el.style.removeProperty("transform-origin");
        el.style.removeProperty("opacity");
        el.dataset.navState = to;
        stateRef.current = to;
        if (to === "home") alignHomeRef.current?.();
        delete el.dataset.navLeaving;
        return;
      }

      const fromRect = el.getBoundingClientRect();
      flyingRef.current?.stop();
      flyingRef.current = null;

      if (mode === "fade") {
        const out = animate(
          el,
          { opacity: 0 },
          { duration: FADE_S, ease: "easeOut" },
        );
        flyingRef.current = out;
        await out.finished.catch(() => undefined);

        el.style.removeProperty("top");
        el.style.removeProperty("transform");
        el.style.removeProperty("transform-origin");
        el.dataset.navState = to;
        stateRef.current = to;

        const fadeIn = animate(
          el,
          { opacity: 1 },
          { duration: FADE_S, ease: "easeOut" },
        );
        flyingRef.current = fadeIn;
        await fadeIn.finished.catch(() => undefined);

        if (flyingRef.current !== fadeIn) return;
        flyingRef.current = null;
        delete el.dataset.navLeaving;
        if (to === "home") alignHomeRef.current?.();
        return;
      }

      // Switching state moves the element's CSS box; measure where it would
      // paint untransformed, then start from where it appears right now.
      //
      // The home dock is zoomed by --fit while the reader's is 1x. Scaling the
      // reader nav would shrink it away from the panel's 1120px back row and
      // its 1x type, so the size change belongs to the flight instead: the
      // first frame is the measured home box, the last is the measured reader
      // box, and the same transform carries the travel and the scale on the
      // drawer's own curve. Without this, width, height and left snap at the
      // state switch (~57px wider, ~29px per side at 1536x864).
      el.style.removeProperty("top");
      el.style.transform = "none";
      el.style.removeProperty("transform-origin");
      el.dataset.navState = to;
      stateRef.current = to;
      const targetRect = el.getBoundingClientRect();
      const delta = fromRect.top - targetRect.top;
      const centerDelta =
        fromRect.left +
        fromRect.width / 2 -
        (targetRect.left + targetRect.width / 2);
      const scale =
        targetRect.width > 0 ? fromRect.width / targetRect.width : 1;
      const startTransform = `translate(${centerDelta}px, ${delta}px) scale(${scale})`;

      // Pin the first painted frame to the old box before starting; Motion's
      // first keyframe then continues from exactly where the switch left it.
      el.style.transformOrigin = "50% 0";
      el.style.transform = startTransform;

      const fallback: NavFlightTiming =
        to === "reader"
          ? { duration: MORPH_OPEN_S, ease: MORPH_EASE }
          : { duration: MORPH_CLOSE_S, ease: "easeIn" };

      const spec = timing ?? fallback;

      const flight = animate(
        el,
        { transform: [startTransform, "translate(0px, 0px) scale(1)"] },
        spec,
      );
      flyingRef.current = flight;

      // Rides the flight from its first painted frame to the moment it settles:
      // it reads the bar's live velocity and paints a Y blur, and never changes
      // the flight itself. Started after `animate` so the first read already
      // includes the flight's own starting transform, and the state switch just
      // before it does not read as a frame of travel.
      beginNavBlur(el, spec.duration);

      // A resize mid-flight lands the move, the way the panel's morph does.
      const finish = () => flight.complete();
      window.addEventListener("resize", finish);
      await flight.finished.catch(() => undefined);
      window.removeEventListener("resize", finish);

      // An interrupted flight must not take the blur off its successor.
      if (flyingRef.current !== flight) return;

      flyingRef.current = null;
      endNavBlur();
      el.style.removeProperty("transform");
      el.style.removeProperty("transform-origin");
      delete el.dataset.navLeaving;
      if (to === "home") alignHomeRef.current?.();

      // Motion writes the final keyframe as an inline style on the frame after
      // `finished` resolves; clear it again so no identity transform lingers.
      requestAnimationFrame(() => {
        if (!flyingRef.current) {
          el.style.removeProperty("transform");
          el.style.removeProperty("transform-origin");
        }
      });
    },
    [],
  );

  const toReader = useCallback(
    (mode: NavFlightMode, timing?: NavFlightTiming) =>
      fly("reader", reduce ? "fade" : mode, timing),
    [fly, reduce],
  );
  const toHome = useCallback(
    (mode: NavFlightMode, timing?: NavFlightTiming) =>
      fly("home", reduce ? "fade" : mode, timing),
    [fly, reduce],
  );

  useLayoutEffect(
    () => registerNavDock({ toReader, toHome }),
    [toReader, toHome],
  );

  // The CSS formula mirrors the home layout; this keeps the placement exact by
  // reading the slot itself, and corrects the CSS if the two ever drift.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const align = () => {
      const slot = document.querySelector<HTMLElement>(SLOT_SELECTOR);
      if (!slot || stateRef.current !== "home" || flyingRef.current) return;

      const slotTop = layoutTop(slot);
      const navTop = layoutTop(el);

      if (Math.abs(slotTop - navTop) > SNAP_PX) {
        el.style.top = `${slotTop}px`;
      }
    };

    alignHomeRef.current = align;
    align();
    window.addEventListener("resize", align);

    return () => {
      alignHomeRef.current = null;
      window.removeEventListener("resize", align);
    };
  }, []);

  // Leaving the reader without a flight (browser Back, a direct load's logo)
  // still has to put the nav back over the home slot.
  useEffect(() => {
    if (readerRoute || stateRef.current === "home") return;

    void fly("home", "fade");
  }, [readerRoute, fly]);

  // Entering one without an open morph (browser Forward restores a study entry
  // without remounting the panel) still has to put the nav in the drawer: the
  // morph is the only other thing that moves it there. A normal open has already
  // set the state by the time this runs, so it is a no-op there.
  useEffect(() => {
    if (!readerRoute || stateRef.current === "reader") return;

    void toReader("flip");
  }, [readerRoute, toReader]);

  // Capture, not bubble: Next's Link starts routing in its own click handler,
  // which would otherwise outrun the motions below.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target as Element;
    const logo = target.closest('a[href="/"]');

    // On the homepage the logo is the page already on screen. Keep it a no-op
    // link: no new history entry, and no scroll jump for a visitor who clicks
    // the orb while scrolled down.
    if (pathname === "/" && logo) {
      event.preventDefault();
      return;
    }

    // In the drawer the logo is the way home: it closes the whole drawer, with
    // the reverse morph, instead of navigating behind it. "Work" is the drawer's
    // own section: from a study it goes to the index (a normal link, which the
    // shell cross-fades), and on the index it is the page already on screen.
    if (stateRef.current === "reader") {
      if (!logo) return;
      if (!hasReaderClose()) return;

      event.preventDefault();
      event.stopPropagation();
      requestReaderClose();
    }
  }

  // The dock is the site's nav; the /dev prototype routes and the /live
  // full-screen pieces draw their own chrome, and the dock's reader rules
  // would cover their corners (T16 M3).
  if (pathname.startsWith("/dev") || pathname.startsWith("/live")) return null;

  return (
    <>
      <NavMotionBlur />
      <div
        ref={ref}
        className="wd-nav-dock"
        data-nav-dock=""
        data-nav-state={initial}
        onClickCapture={onClickCapture}
      >
        <HomeNav />
      </div>
    </>
  );
}
