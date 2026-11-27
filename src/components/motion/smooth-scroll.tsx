"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import "./smooth-scroll.css";

/**
 * The live case-study scroller. The selector deliberately excludes the
 * outgoing snapshot (`data-leave`), a closed shell and every other scroll box:
 * the index is `#wd-index-scroll`, and the canvas reader has no
 * `#wd-reader-scroll` at all. A route swap replaces the view, so the provider
 * rebinds to the new element.
 */
const READER_SELECTOR =
  '.wd-expand-layer:not([data-phase="closed"]) .wd-drawer-view:not([data-leave]) #wd-reader-scroll';

/**
 * Trial (pf-9cv.18): Lenis smooth scrolling, scoped to the work reader.
 *
 * The shipped routes are fitted to the viewport, so the window itself does not
 * scroll on `/` or `/work*`; the case studies scroll inside the drawer's
 * `.wd-reader-scroll`. Lenis is mounted on that element directly (wrapper,
 * content and event target), not on the window: there is no page-level
 * instance and `allowNestedScroll` stays off, so the index, a dialog, the
 * canvas or any future nested scroller can never be adopted.
 *
 * Surfaces that must keep their own wheel behaviour carry
 * `data-lenis-prevent`: the WebGL canvas (pan and wheel zoom), its focus
 * viewer, and the art dialog. They are outside this scoped instance already;
 * the attributes keep the exclusion explicit and future-proof.
 *
 * Touch is never smoothed (`syncTouch: false`), so the mobile gate and every
 * touch scroll stay native. Reduced motion is not a softer lerp: the instance
 * is destroyed, the reader loses `.lenis`, and the page falls back to the
 * browser's own scrolling.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    // The hook starts from the server snapshot (false) and corrects after
    // hydration, but this effect can run first. Read the live preference so a
    // reduced-motion load never constructs Lenis in that window.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let bound: {
      reader: HTMLElement;
      lenis: Lenis;
      cleanup: () => void;
    } | null = null;
    let frame = 0;

    function unbind() {
      if (!bound) return;
      bound.cleanup();
      bound = null;
    }

    function bind() {
      const reader = document.querySelector<HTMLElement>(READER_SELECTOR);

      // Same element: keep the live instance. Route swaps replace the view,
      // so a new element always goes through the full bind below.
      if (bound?.reader === reader) return;

      unbind();

      if (!reader) return;

      // Keep the narrowed element; the closures below outlive the check.
      const element = reader;
      const column =
        element.querySelector<HTMLElement>(".wd-reader-column") ?? element;
      const lenis = new Lenis({
        wrapper: element,
        content: column,
        eventsTarget: element,
        lerp: 0.1,
        autoRaf: true,
        wheelMultiplier: 1,
        syncTouch: false,
        // Explicit: only this wrapper is smoothed. Lenis must not discover and
        // adopt any other scroll box the way allowNestedScroll: "smooth" did.
        allowNestedScroll: false,
        respectReducedMotion: true,
      });

      /**
       * A native programmatic scroll (`scrollTo({ behavior: "smooth" })`, an
       * anchor, a scrollbar drag, PageDown) must win over Lenis' in-flight
       * animation. Lenis ignores native scroll events while it is animating, so
       * without this the reader's "↑ Top" and any in-page jump were pulled back
       * to the wheel's target. When the actual position leaves the value Lenis
       * last wrote, close the animation on the native position; the browser's
       * own scroll then continues undisturbed.
       */
      function yieldToNativeScroll() {
        if (lenis.isScrolling !== "smooth") return;
        if (Math.abs(lenis.actualScroll - lenis.animatedScroll) < 2) return;

        lenis.scrollTo(lenis.actualScroll, {
          immediate: true,
          force: true,
        });
      }

      /**
       * A press or key that will scroll natively must land before Lenis writes
       * its next frame: the write itself would cancel the browser's smooth
       * scroll. Stop the momentum first, but only for events inside this
       * reader; the canvas, the viewer and the nav are not in scope.
       */
      function stopInertia(event: Event) {
        const target = event.target;

        if (!(target instanceof Node) || !element.contains(target)) return;
        if (lenis.isScrolling !== "smooth") return;

        lenis.scrollTo(lenis.actualScroll, {
          immediate: true,
          force: true,
        });
      }

      element.addEventListener("scroll", yieldToNativeScroll, {
        passive: true,
      });
      document.addEventListener("pointerdown", stopInertia, {
        capture: true,
        passive: true,
      });
      document.addEventListener("keydown", stopInertia, { capture: true });

      bound = {
        reader: element,
        lenis,
        cleanup: () => {
          element.removeEventListener("scroll", yieldToNativeScroll);
          document.removeEventListener("pointerdown", stopInertia, {
            capture: true,
          });
          document.removeEventListener("keydown", stopInertia, {
            capture: true,
          });
          lenis.destroy();
        },
      };
    }

    function schedule() {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        bind();
      });
    }

    // Delay the first bind by one frame: Lenis adds `.lenis` to the
    // server-rendered reader, and doing that before React has finished
    // hydrating the page reads as an attribute mismatch. By the first frame
    // the hydration pass is done.
    schedule();

    // A study swap replaces the view; a close flips the layer's phase. Watch
    // just those two facts instead of re-reading the DOM on every frame.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-phase", "data-leave"],
    });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      unbind();
    };
  }, [reduced]);

  return null;
}
