"use client";

import { animate, motion, useMotionValue } from "motion/react";
import type { Transition } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { DOCK_SELECTOR } from "@/components/nav/nav-flight";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { WORK_SHEET_OPEN_EVENT } from "@/lib/work-sheet-state";
import type { WorkMeta } from "@/lib/work";
import { ProtoLayoutToggle, useProtoLayout } from "./proto-layout-toggle";
import { useEscToClose } from "./reader-close";
import { dragOffset, releaseVelocity, shouldDismiss } from "./sheet-drag";
import type { Sample } from "./sheet-drag";
import { useOverlayBehaviour } from "./use-overlay-behaviour";
import { WorkGrid } from "./work-grid";
import { WorkIndexList } from "./work-index-list";
import "./work-sheet.css";

/**
 * The Work sheet: the whole index, from the nav's "Work" item, over the live
 * homepage.
 *
 * It is a spring, not a timed curve, because it can be reversed at any moment:
 * a backdrop click during the rise, or "Work" again during the fall, retargets
 * the same motion value from wherever it is and carries its velocity. The drag
 * writes that value directly and hands its own release velocity to the spring
 * that follows.
 *
 * Entering and leaving the route are the page's: `/work` renders it, so a nav
 * click mounts it and a direct load arrives with it already in the document,
 * open at rest. Close animates first, then routes, so the exit is never cut off
 * by the unmount. A study opens over it in the modal slot, which leaves this
 * page — and the sheet's scroll — exactly where they were.
 */

/** The rise: near the drawer's feel, without its 900ms tail. */
const OPEN_SPRING = { type: "spring", duration: 0.55, bounce: 0.08 } as const;

/** A dismissal the gesture did not fling: quicker than the rise, ease-in. */
const EXIT = { duration: 0.25, ease: "easeIn" } as const;

/** A release that carried speed keeps going, then settles. */
const FLING = { type: "spring", stiffness: 300, damping: 42 } as const;

/** A release that did not: back to the open position, on its own velocity. */
const SNAP_BACK = { type: "spring", stiffness: 380, damping: 38 } as const;

/** Reduced motion: the reader's opacity-only fade. */
const REDUCED_FADE_MS = 120;

/** A stalled frame loop must not hold the route change hostage. */
const CLOSE_CAP_MS = 700;

/** Below this the pointer is pressing, not dragging. */
const DRAG_THRESHOLD_PX = 4;

type SheetPhase = "opening" | "open" | "closing";

type Drag = {
  pointerId: number;
  origin: "header" | "body";
  startX: number;
  startY: number;
  dy: number;
  active: boolean;
  samples: Sample[];
};

const TITLE_ID = "wd-sheet-title";

export function WorkSheet({ works }: { works: WorkMeta[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const layout = useProtoLayout();
  // A direct load of `/work` arrives as server markup, so this element is
  // already in the document when the first client render runs; a soft
  // navigation creates it from nothing. The server only ever renders the direct
  // route, so it renders the sheet at rest, and hydration agrees. A direct load
  // is already the destination: it starts open, with no rise. (Same
  // read-once trick as HomeEntrancePlayed.)
  const [direct] = useState(
    () =>
      typeof document === "undefined" ||
      document.querySelector("[data-work-sheet]") !== null,
  );

  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const phaseRef = useRef<SheetPhase>(direct ? "open" : "opening");
  const [phase, setPhase] = useState<SheetPhase>(direct ? "open" : "opening");

  const setSheetPhase = useCallback((next: SheetPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const sheetHeight = useCallback(
    () => panelRef.current?.offsetHeight ?? window.innerHeight,
    [],
  );

  const runTo = useCallback(
    (target: number, transition: Transition) => {
      animationRef.current?.stop();

      const controls = animate(y, target, transition);
      animationRef.current = controls;

      return controls;
    },
    [y],
  );

  const animateOpen = useCallback(() => {
    // Reduced motion never moves the sheet: the CSS fade is the whole entrance,
    // and the phase is held on "opening" for the fade's own 120ms.
    if (reduce) {
      y.set(0);

      window.setTimeout(() => {
        if (phaseRef.current !== "opening") return;

        setSheetPhase("open");
      }, REDUCED_FADE_MS);

      return;
    }

    const controls = runTo(0, OPEN_SPRING);

    void controls.finished
      .then(() => {
        if (animationRef.current === controls) setSheetPhase("open");
      })
      .catch(() => undefined);
  }, [reduce, runTo, setSheetPhase, y]);

  // Before the first paint the sheet is off screen, so the rise starts from
  // below the viewport instead of flashing in place; a direct load is already
  // the destination and starts at rest.
  useLayoutEffect(() => {
    if (direct) {
      document.documentElement.dataset.entrancePlayed = "true";

      return;
    }

    y.set(sheetHeight());
    animateOpen();
  }, [animateOpen, direct, sheetHeight, y]);

  // A study opened from this sheet has to find the sheet still underneath it:
  // the reader's page is intercepted into the modal slot, while this page — and
  // the sheet on it — stays mounted below.
  const requestClose = useCallback(
    (velocity = 0) => {
      if (phaseRef.current === "closing") return;

      setSheetPhase("closing");

      // A release with speed keeps its speed; every other way out is the
      // quicker exit curve.
      const flight = reduce
        ? null
        : runTo(
            sheetHeight(),
            velocity > 0 ? { ...FLING, velocity } : EXIT,
          );

      void (async () => {
        await Promise.race([
          flight?.finished.catch(() => undefined) ?? Promise.resolve(),
          new Promise((resolve) =>
            window.setTimeout(resolve, reduce ? REDUCED_FADE_MS : CLOSE_CAP_MS),
          ),
        ]);

        // Re-opened mid-close: the sheet never left.
        if (phaseRef.current !== "closing") return;

        if (window.location.pathname !== "/work") return;

        // A sheet the nav pushed from the homepage goes back to it; a direct
        // load is the document's own entry and is replaced instead, so Back
        // cannot reopen it.
        if (direct) router.replace("/");
        else router.back();
      })();
    },
    [direct, reduce, router, runTo, setSheetPhase, sheetHeight],
  );

  const close = useCallback(() => requestClose(), [requestClose]);

  // "Work" was clicked while this sheet is the destination: reopen if it was on
  // its way out, otherwise it is already here and nothing moves.
  useEffect(() => {
    function onOpenRequest() {
      if (phaseRef.current !== "closing") return;

      setSheetPhase("opening");
      animateOpen();
    }

    window.addEventListener(WORK_SHEET_OPEN_EVENT, onOpenRequest);

    return () =>
      window.removeEventListener(WORK_SHEET_OPEN_EVENT, onOpenRequest);
  }, [animateOpen, setSheetPhase]);

  // A reader opened over the sheet owns Esc, the tab trap and the top layer.
  const underReader = pathname.startsWith("/work/");

  useEscToClose(underReader ? undefined : close);

  useOverlayBehaviour(panelRef, {
    // The sheet owns the page as soon as it has landed. A rise is short, but
    // flagging the background restyles it, and that wait belongs after the
    // sheet's own first frames exactly as it does in the reader.
    lockHome: phase === "open" || reduce,
    covered: true,
    trap: !underReader,
    returnFocus: () => {
      // Development Strict Mode runs this cleanup once on mount, with the sheet
      // still on screen; only a sheet that has actually left gives focus back.
      if (document.querySelector("[data-work-sheet]")) return;

      document
        .querySelector<HTMLElement>(`${DOCK_SELECTOR} a[aria-label="Work"]`)
        ?.focus({ preventScroll: true });
    },
  });

  // A soft-navigation open takes focus; a direct load leaves it where the
  // visitor put it.
  useEffect(() => {
    if (direct) return;

    panelRef.current
      ?.querySelector<HTMLElement>(`#${TITLE_ID}`)
      ?.focus({ preventScroll: true });
  }, [direct]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    const drag = dragRef.current;

    if (panel?.hasPointerCapture(event.pointerId)) {
      panel.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;

    return drag;
  }, []);

  // Touch on the body is its own path: `touch-action` there stays the scroller's
  // (a pan must still scroll the list), so the browser owns the gesture before
  // we can, and pointer events stop as soon as it starts one. A first move that
  // is clearly downward cancels the pan and hands the sheet the gesture.
  const touchRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    samples: Sample[];
  } | null>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || scroll!.scrollTop > 0) return;

      const touch = event.touches[0];

      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        active: false,
        samples: [{ y: 0, t: event.timeStamp }],
      };
    }

    function onTouchMove(event: TouchEvent) {
      const drag = touchRef.current;
      if (!drag || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dy = touch.clientY - drag.startY;
      const dx = touch.clientX - drag.startX;

      if (!drag.active) {
        // Upward or sideways belongs to the scroller; leave it alone.
        if (dy < DRAG_THRESHOLD_PX || Math.abs(dx) > Math.abs(dy)) return;

        drag.active = true;
        animationRef.current?.stop();
      }

      event.preventDefault();

      drag.samples.push({ y: dy, t: event.timeStamp });
      if (drag.samples.length > 8) drag.samples.shift();

      y.set(dragOffset(dy, sheetHeight()));
    }

    function onTouchEnd() {
      const drag = touchRef.current;
      touchRef.current = null;

      if (!drag?.active) return;

      const height = sheetHeight();
      const velocity = releaseVelocity(drag.samples);
      const offset = drag.samples[drag.samples.length - 1]?.y ?? 0;

      if (shouldDismiss(dragOffset(offset, height), velocity, height)) {
        requestClose(velocity);

        return;
      }

      runTo(0, { ...SNAP_BACK, velocity });
    }

    scroll.addEventListener("touchstart", onTouchStart, { passive: true });
    // Not passive: claiming a downward pull is cancelling the browser's pan.
    scroll.addEventListener("touchmove", onTouchMove, { passive: false });
    scroll.addEventListener("touchend", onTouchEnd);
    scroll.addEventListener("touchcancel", onTouchEnd);

    return () => {
      scroll.removeEventListener("touchstart", onTouchStart);
      scroll.removeEventListener("touchmove", onTouchMove);
      scroll.removeEventListener("touchend", onTouchEnd);
      scroll.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [requestClose, runTo, sheetHeight, y]);

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    origin: Drag["origin"],
  ) {
    if (dragRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest("[data-sheet-nodrag]")) return;

    // The body's touch gesture has its own listener (it has to cancel a pan
    // that the pointer stream cannot survive); the handle's does not.
    if (origin === "body" && event.pointerType !== "mouse") return;

    // The body only drags from the top of its own scroll: anywhere else a
    // downward swipe belongs to the content.
    if (origin === "body" && (scrollRef.current?.scrollTop ?? 0) > 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      origin,
      startX: event.clientX,
      startY: event.clientY,
      dy: 0,
      active: false,
      samples: [{ y: 0, t: event.timeStamp }],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dy = event.clientY - drag.startY;
    const dx = event.clientX - drag.startX;

    if (!drag.active) {
      const vertical = Math.abs(dy) > Math.abs(dx);

      if (!vertical || Math.abs(dy) < DRAG_THRESHOLD_PX) {
        // Sideways belongs to nothing here; upward from the body belongs to the
        // scroller, but from the handle it is the sheet's own rubber band.
        if (drag.origin === "body" && !vertical) endDrag(event);

        return;
      }

      if (drag.origin === "body" && dy < 0) {
        // The content scrolls down from the top; the sheet never drags up from
        // its own body.
        endDrag(event);

        return;
      }

      drag.active = true;
      // Take the motion value where it is: a rise still in flight hands over.
      animationRef.current?.stop();
      panelRef.current?.setPointerCapture(event.pointerId);
    }

    drag.dy = dy;
    drag.samples.push({ y: dy, t: event.timeStamp });
    if (drag.samples.length > 8) drag.samples.shift();

    y.set(dragOffset(dy, sheetHeight()));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const drag = endDrag(event);
    if (!drag?.active) return;

    const height = sheetHeight();
    const velocity = releaseVelocity(drag.samples);

    if (shouldDismiss(dragOffset(drag.dy, height), velocity, height)) {
      requestClose(velocity);

      return;
    }

    runTo(0, { ...SNAP_BACK, velocity });
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
    const drag = endDrag(event);
    if (!drag?.active) return;

    runTo(0, SNAP_BACK);
  }

  return (
    <div
      className="wd-sheet-layer"
      data-phase={phase}
      data-reduced={reduce ? "" : undefined}
      data-work-sheet=""
    >
      <div
        className="wd-sheet-backdrop"
        aria-hidden="true"
        onClick={close}
      />

      <motion.div
        ref={panelRef}
        style={{ y }}
        className="wd-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* The grab strip and the header drag from anywhere; the title row's
            own controls opt out. */}
        <header
          className="wd-sheet-head"
          onPointerDown={(event) => beginDrag(event, "header")}
        >
          <button
            type="button"
            className="wd-sheet-grab"
            aria-label="Close work"
            onClick={close}
          >
            <span className="wd-sheet-grab-bar" aria-hidden="true" />
          </button>

          <div className="wd-sheet-title-row">
            <h2 id={TITLE_ID} tabIndex={-1} className="wd-sheet-title">
              Work
            </h2>
            <p className="wd-sheet-count">{works.length} studies</p>
            <ProtoLayoutToggle />
          </div>
        </header>

        <div
          ref={scrollRef}
          className="wd-sheet-scroll"
          onPointerDown={(event) => beginDrag(event, "body")}
        >
          {layout === "grid" ? (
            <WorkGrid works={works} />
          ) : (
            <WorkIndexList works={works} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
