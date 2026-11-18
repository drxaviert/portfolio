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
  const readerRoute = pathname.startsWith("/work/");
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

      // Nothing has loaded the reader in this document, so there is no motion to
      // fly with and no drawer to fly into: take the new place at once.
      const animate = getDockAnimate();
      if (!animate) {
        el.style.removeProperty("top");
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.dataset.navState = to;
        stateRef.current = to;
        if (to === "home") alignHomeRef.current?.();
        return;
      }

      const from = el.getBoundingClientRect().top;
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
        if (to === "home") alignHomeRef.current?.();
        return;
      }

      // Switching state moves the element's CSS box; measure where it would
      // paint untransformed, then start from where it appears right now.
      el.style.removeProperty("top");
      el.style.transform = "none";
      el.dataset.navState = to;
      stateRef.current = to;
      const target = el.getBoundingClientRect().top;
      const delta = from - target;

      const fallback: NavFlightTiming =
        to === "reader"
          ? { duration: MORPH_OPEN_S, ease: MORPH_EASE }
          : { duration: MORPH_CLOSE_S, ease: "easeIn" };

      const flight = animate(
        el,
        { transform: [`translateY(${delta}px)`, "translateY(0px)"] },
        timing ?? fallback,
      );
      flyingRef.current = flight;

      // A resize mid-flight lands the move, the way the panel's morph does.
      const finish = () => flight.complete();
      window.addEventListener("resize", finish);
      await flight.finished.catch(() => undefined);
      window.removeEventListener("resize", finish);

      if (flyingRef.current !== flight) return;

      flyingRef.current = null;
      el.style.removeProperty("transform");
      if (to === "home") alignHomeRef.current?.();

      // Motion writes the final keyframe as an inline style on the frame after
      // `finished` resolves; clear it again so no identity transform lingers.
      requestAnimationFrame(() => {
        if (!flyingRef.current) el.style.removeProperty("transform");
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
  // which would otherwise outrun the close.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (stateRef.current !== "reader") return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (!hasReaderClose()) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (!(event.target as Element).closest('a[href="/"]')) return;

    event.preventDefault();
    event.stopPropagation();
    requestReaderClose();
  }

  // The dock is the site's nav; the /dev prototype routes draw their own
  // chrome and the dock's reader rules would cover their corners (T16 M3).
  if (pathname.startsWith("/dev")) return null;

  return (
    <div
      ref={ref}
      className="wd-nav-dock"
      data-nav-dock=""
      data-nav-state={initial}
      onClickCapture={onClickCapture}
    >
      <HomeNav />
    </div>
  );
}
