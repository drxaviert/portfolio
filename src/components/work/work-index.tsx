"use client";

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { LayoutToggle } from "./layout-toggle";
import {
  applyLayoutAttribute,
  chooseLayout as chooseStoredLayout,
  LAYOUT_ATTRIBUTE,
  getLayoutServerSnapshot,
  getLayoutSnapshot,
  subscribeToLayout,
} from "./layout-preference";
import type { WorkLayout } from "./layout-preference";
import { WorkGrid } from "./work-grid";
import { WorkIndexList } from "./work-index-list";
import "./work-index.css";

export const INDEX_TITLE_ID = "wd-index-title";
export const INDEX_SCROLL_ID = "wd-index-scroll";

/** The crossfade between layouts: short, ease-out, and interruptible. */
const LAYOUT_SWITCH_MS = 200;
const LAYOUT_SWITCH_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Where the index was left. The drawer keeps this module alive while a study
 * takes the panel (the shell does not remount), so stepping back to the index
 * lands where it was; a study always opens at its own top, because its content
 * is new.
 */
let indexScroll = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The index inside the drawer: the whole set of studies, in the visitor's
 * layout (grid by default), with the grid / list switch beside the title.
 *
 * Both layouts are rendered, and the stylesheet picks one from the
 * `data-work-layout` attribute on `<html>`. That attribute is set before paint
 * on a hard load by the head bootstrap in the root layout, so a stored "list"
 * never flashes the grid; the switch animates the change.
 *
 * The column mirrors the reader's own: the same nav clearance at the top, the
 * same safe bottom padding, and one scroll container of its own.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  const layout = useSyncExternalStore(
    subscribeToLayout,
    getLayoutSnapshot,
    getLayoutServerSnapshot,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /**
   * Each layout's own last scroll position, unclamped. A shorter layout clamps
   * the shared scroll box when it is shown, so the return trip would otherwise
   * start from that clamped value and lose the longer layout's place.
   */
  const layoutScrollRef = useRef<Record<WorkLayout, number | null>>({
    grid: null,
    list: null,
  });
  /** The layout on screen, for the scroll recorder between renders. */
  const layoutRef = useRef(layout);
  /** What the next switch needs, measured before the attribute flips. */
  const pendingRef = useRef<{
    from: WorkLayout;
    height: number;
    reduce: boolean;
    scrollTop: number;
  } | null>(null);
  /** The running switch, so a new one can finish it first. */
  const switchRef = useRef<{ finish: () => void } | null>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    scroll.scrollTop = indexScroll;

    // Record every scroll rather than the element's last position on unmount:
    // by the time an unmount cleanup runs the node can already be detached, and
    // its scrollTop would read 0 over the real value.
    const record = () => {
      indexScroll = scroll.scrollTop;

      // While a switch travels through the shorter layout's height, the box
      // clamps on the way and those values are not where the visitor was.
      if (!switchRef.current) {
        layoutScrollRef.current[layoutRef.current] = scroll.scrollTop;
      }
    };

    scroll.addEventListener("scroll", record, { passive: true });

    return () => scroll.removeEventListener("scroll", record);
  }, []);

  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Keep the attribute the stylesheet reads in step with the store, without
  // overwriting the one the bootstrap script set before paint: during
  // hydration this render still carries the server's grid, and writing it would
  // clobber a stored list. Only a client navigation with no attribute yet needs
  // this, and the store's own choice already applies it.
  useLayoutEffect(() => {
    if (!document.documentElement.hasAttribute(LAYOUT_ATTRIBUTE)) {
      applyLayoutAttribute(layout);
    }
  }, [layout]);

  // Finish an interrupted switch before cleaning up.
  useLayoutEffect(() => {
    return () => switchRef.current?.finish();
  }, []);

  const chooseLayout = useCallback(
    (next: WorkLayout) => {
      if (next === layout) return;

      const stack = stackRef.current;

      switchRef.current?.finish();

      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      // The outgoing layout remembers where it was, unclamped; the incoming
      // one comes back to its own last place (or this one on a first visit).
      layoutScrollRef.current[layout] = scrollTop;

      pendingRef.current = {
        from: layout,
        height: stack?.getBoundingClientRect().height ?? 0,
        reduce: prefersReducedMotion(),
        scrollTop: layoutScrollRef.current[next] ?? scrollTop,
      };

      chooseStoredLayout(next);
    },
    [layout],
  );

  // The switch itself, after the attribute has flipped: the outgoing layout
  // fades out over the incoming one while the stack's height travels to the
  // new layout's; reduced motion just swaps.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;

    if (!pending || pending.from === layout) return;

    const stack = stackRef.current;
    const outgoing =
      pending.from === "grid" ? gridRef.current : listRef.current;
    const incoming = layout === "grid" ? gridRef.current : listRef.current;

    if (!stack || !outgoing || !incoming) return;

    const endHeight = incoming.getBoundingClientRect().height;

    const restoreScroll = () => {
      const scroll = scrollRef.current;
      if (!scroll) return;

      // Clamp only now, against the layout that is actually landing: the
      // remembered value stays unclamped so the next return trip keeps it.
      const top = Math.min(
        pending.scrollTop,
        Math.max(0, scroll.scrollHeight - scroll.clientHeight),
      );

      scroll.scrollTop = top;
      indexScroll = top;
      layoutScrollRef.current[layout] = top;
    };

    if (pending.reduce || pending.height <= 0 || endHeight <= 0) {
      restoreScroll();
      return;
    }

    // Lift the outgoing layout, which the stylesheet has just hidden, onto the
    // stack as an inert picture for the fade.
    outgoing.style.position = "absolute";
    outgoing.style.inset = "0 0 auto 0";
    outgoing.style.width = "100%";
    outgoing.style.zIndex = "1";
    outgoing.style.pointerEvents = "none";
    outgoing.style.display = "block";
    outgoing.setAttribute("inert", "");
    outgoing.setAttribute("aria-hidden", "true");

    stack.style.height = `${pending.height}px`;
    stack.style.overflow = "hidden";

    const options = { duration: LAYOUT_SWITCH_MS, easing: LAYOUT_SWITCH_EASE };
    const height = stack.animate(
      [{ height: `${pending.height}px` }, { height: `${endHeight}px` }],
      { ...options, fill: "forwards" },
    );
    const out = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
      ...options,
      duration: LAYOUT_SWITCH_MS - 20,
      fill: "forwards",
    });
    const inAnim = incoming.animate([{ opacity: 0 }, { opacity: 1 }], options);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      height.cancel();
      out.cancel();
      inAnim.cancel();
      stack.style.removeProperty("height");
      stack.style.removeProperty("overflow");
      outgoing.removeAttribute("style");
      outgoing.removeAttribute("inert");
      outgoing.removeAttribute("aria-hidden");
      restoreScroll();

      if (switchRef.current?.finish === finish) switchRef.current = null;
    };

    switchRef.current = { finish };
    void height.finished.then(finish, finish);
  }, [layout]);

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={INDEX_SCROLL_ID} className="wd-index-scroll" ref={scrollRef}>
        <div className="wd-index-column">
          <header className="wd-index-head">
            <div className="wd-index-heading">
              <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-index-title">
                Work
              </h1>
              <p className="wd-index-count">{works.length} studies</p>
            </div>

            <LayoutToggle value={layout} onChange={chooseLayout} />
          </header>

          <div className="wd-index-layouts" ref={stackRef}>
            <div data-layout="grid" ref={gridRef}>
              <WorkGrid works={works} />
            </div>
            <div data-layout="list" ref={listRef}>
              <WorkIndexList works={works} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
