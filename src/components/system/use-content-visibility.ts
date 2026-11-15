"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Viewport-gated rendering for long documents.
 *
 * Every element that uses this hook stays in the document (so SSR, marks and
 * link targets are unchanged), but once it is more than a screen away the
 * browser skips its style, layout and paint via `content-visibility: hidden`.
 * An explicit intrinsic height keeps the scrollbar and anchor positions still.
 *
 * Sections use a zero margin (only what intersects the viewport is rendered);
 * token rows use one viewport of margin so the next row is ready before it
 * scrolls in. Keyboard navigation and find-in-page return everything to
 * `visible` first, and the next pointer press re-applies the window.
 */

const SECTION_MARGIN = 0;
const ROW_MARGIN = 1;

const observers = new Map<number, IntersectionObserver>();
const tracked = new Map<HTMLElement, number>();
const heights = new WeakMap<HTMLElement, number>();
let forceVisible = false;
let listening = false;

function measure(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();

  // contain-intrinsic-size is a content-box size; the rect is a border box.
  // Subtracting the element's own padding/border keeps the hidden placeholder
  // the same height as the rendered element.
  if (rect.height > 0) {
    const style = window.getComputedStyle(element);
    const vertical =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);

    heights.set(element, Math.max(1, rect.height - vertical));
  }

  // A hidden ancestor measures 0; keep the last real height instead.
  return heights.get(element) ?? 0;
}

function reveal(element: HTMLElement): void {
  element.style.contentVisibility = "visible";
}

function conceal(element: HTMLElement): void {
  const height = measure(element);

  element.style.containIntrinsicSize = `${Math.max(1, height).toFixed(2)}px`;
  element.style.contentVisibility = "hidden";
}

function inWindow(element: HTMLElement, margin: number): boolean {
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight;

  return rect.bottom >= -height * margin && rect.top <= height * (1 + margin);
}

function consider(element: HTMLElement, margin: number): void {
  if (inWindow(element, margin)) reveal(element);
  else conceal(element);
}

function revealAll(): void {
  forceVisible = true;

  for (const element of tracked.keys()) reveal(element);
}

/**
 * Re-measure every tracked element, including hidden ones. Web fonts land
 * after the first effects and change row/section heights, so the intrinsic
 * sizes captured before that would make the document shorter than its content.
 * Revealing and re-hiding in one task keeps that out of a paint.
 */
function refresh(): void {
  // Sections first: a row inside a hidden section has no box to measure.
  for (const [element, margin] of tracked) {
    if (margin === SECTION_MARGIN && element.style.contentVisibility === "hidden") {
      reveal(element);
    }
  }

  for (const [element, margin] of tracked) {
    if (margin !== SECTION_MARGIN && element.style.contentVisibility === "hidden") {
      reveal(element);
    }
  }

  for (const element of tracked.keys()) measure(element);

  for (const [element, margin] of tracked) {
    if (margin === SECTION_MARGIN) consider(element, margin);
  }

  for (const [element, margin] of tracked) {
    if (margin !== SECTION_MARGIN) consider(element, margin);
  }
}

function resumeWindow(): void {
  if (!forceVisible) return;

  forceVisible = false;

  for (const [element, margin] of tracked) consider(element, margin);
}

function observerFor(margin: number): IntersectionObserver {
  const existing = observers.get(margin);

  if (existing) return existing;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (forceVisible || entry.isIntersecting) {
          reveal(entry.target as HTMLElement);
        } else {
          conceal(entry.target as HTMLElement);
        }
      }
    },
    { rootMargin: margin === SECTION_MARGIN ? "0px" : "100% 0px" },
  );

  observers.set(margin, observer);

  return observer;
}

let teardown: (() => void) | null = null;

function listen(): void {
  if (listening || typeof window === "undefined") return;

  listening = true;

  const onKeyDown = (event: KeyboardEvent) => {
    const finding =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";

    if (event.key === "Tab" || finding) revealAll();
  };

  // The first effects run before Work Sans swaps in; re-measure once it has.
  // load can fire before a font-display swap, so the font promise gets its own
  // refresh rather than sharing the load guard.
  let refreshedOnLoad = false;

  const refreshOnLoad = () => {
    if (refreshedOnLoad) return;

    refreshedOnLoad = true;
    window.requestAnimationFrame(refresh);
  };

  const onFonts = () => {
    window.requestAnimationFrame(refresh);
  };

  let timer: number | null = null;

  const onResize = () => {
    if (timer !== null) window.clearTimeout(timer);

    timer = window.setTimeout(() => {
      timer = null;
      refresh();
    }, 150);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointerdown", resumeWindow, { passive: true });
  window.addEventListener("beforeprint", revealAll);
  window.addEventListener("load", refreshOnLoad);
  window.addEventListener("resize", onResize);

  if (document.fonts) {
    void document.fonts.ready.then(onFonts);
  }

  teardown = () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("pointerdown", resumeWindow);
    window.removeEventListener("beforeprint", revealAll);
    window.removeEventListener("load", refreshOnLoad);
    window.removeEventListener("resize", onResize);

    if (timer !== null) window.clearTimeout(timer);
  };
}

/** Stops the shared listeners when the last gated element unmounts. */
function maybeUnlisten(): void {
  if (tracked.size > 0 || !teardown) return;

  teardown();
  teardown = null;
  listening = false;
  forceVisible = false;
}

export function useContentVisibility<T extends HTMLElement>(
  scope: "section" | "row" = "row",
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;

    // jsdom and very old engines have no observer: leave the document visible.
    if (!element || typeof IntersectionObserver === "undefined") return;

    const margin = scope === "section" ? SECTION_MARGIN : ROW_MARGIN;
    const observer = observerFor(margin);

    listen();
    tracked.set(element, margin);
    measure(element);
    observer.observe(element);

    return () => {
      observer.unobserve(element);
      tracked.delete(element);
      heights.delete(element);

      if (![...tracked.values()].includes(margin)) {
        observer.disconnect();
        observers.delete(margin);
      }

      maybeUnlisten();
    };
  }, [scope]);

  return ref;
}
