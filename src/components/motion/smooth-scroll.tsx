"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import "./smooth-scroll.css";

/**
 * Trial (pf-9cv.18): Lenis smooth scrolling on the page's scroll surfaces.
 *
 * The shipped routes are fitted to the viewport, so the window itself does not
 * scroll on `/` or `/work*`; the case studies scroll inside the drawer's
 * `.wd-reader-scroll`. `allowNestedScroll: "smooth"` lets the one window
 * instance adopt a nested scroller on its first wheel gesture and smooth it
 * with the same options, without a second provider or per-route mounting.
 *
 * Surfaces that must keep their own wheel behaviour carry
 * `data-lenis-prevent`: the WebGL canvas (pan and wheel zoom), its focus
 * viewer, and the art dialog. Touch is never smoothed (`syncTouch: false`), so
 * the mobile gate and every touch scroll stay native.
 *
 * Reduced motion is not a softer lerp: the instance is destroyed, <html>
 * loses `.lenis`, and the page falls back to the browser's own scrolling.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({
      lerp: 0.1,
      autoRaf: true,
      wheelMultiplier: 1,
      syncTouch: false,
      allowNestedScroll: "smooth",
      // A route change must not inherit momentum from the page it left.
      stopInertiaOnNavigate: true,
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
    function yieldToNativeScroll(event: Event) {
      const target = event.target;
      const wrapper =
        target === document
          ? document.documentElement
          : target instanceof Element
            ? target
            : null;

      if (!wrapper) return;

      const instance =
        wrapper === document.documentElement ? lenis : Lenis.get(wrapper);

      if (!instance || instance.isScrolling !== "smooth") return;
      if (Math.abs(instance.actualScroll - instance.animatedScroll) < 2) return;

      instance.scrollTo(instance.actualScroll, {
        immediate: true,
        force: true,
      });
    }

    /**
     * A press or key that will scroll natively must land before Lenis writes
     * its next frame: the write itself would cancel the browser's smooth
     * scroll. Stop the momentum on the target's own scroller first, then let
     * the click, PageDown or scrollbar drag do its normal job.
     */
    function stopInertia(event: Event) {
      let element: Element | null =
        event.target instanceof Element
          ? event.target
          : document.documentElement;

      while (element) {
        const instance =
          element === document.documentElement ? lenis : Lenis.get(element);

        if (instance?.isScrolling === "smooth") {
          instance.scrollTo(instance.actualScroll, {
            immediate: true,
            force: true,
          });
        }

        element = element.parentElement;
      }
    }

    document.addEventListener("scroll", yieldToNativeScroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointerdown", stopInertia, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", stopInertia, { capture: true });

    return () => {
      document.removeEventListener("scroll", yieldToNativeScroll, {
        capture: true,
      });
      document.removeEventListener("pointerdown", stopInertia, {
        capture: true,
      });
      document.removeEventListener("keydown", stopInertia, { capture: true });
      lenis.destroy();
    };
  }, [reduced]);

  return null;
}
