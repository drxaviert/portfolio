"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Opt a long-document block into browser-managed lazy rendering.
 *
 * `content-visibility: auto` lets the browser skip layout and paint for content
 * that is off-screen while keeping it in the accessibility tree, find-in-page,
 * tab order and hash navigation. `contain-intrinsic-size: auto <measured>px`
 * gives it a placeholder height until it has been rendered once, and lets the
 * browser remember the real size afterwards, so the scrollbar never jumps.
 *
 * Sizes are measured as content-box heights because contain-intrinsic-size is
 * a content-box size while getBoundingClientRect is a border box. They are
 * re-measured after web fonts load and after a resize.
 */

const tracked = new Set<HTMLElement>();
const heights = new WeakMap<HTMLElement, number>();
let listening = false;
let teardown: (() => void) | null = null;

function measure(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();

  if (rect.height > 0) {
    const style = window.getComputedStyle(element);
    const vertical =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);

    heights.set(element, Math.max(1, rect.height - vertical));
  }

  const height = heights.get(element);

  if (height !== undefined) {
    element.style.containIntrinsicSize = `auto ${height.toFixed(2)}px`;
  }

  element.style.contentVisibility = "auto";
}

/**
 * Re-measure everything, including content the browser is currently skipping.
 * Revealing and re-lazying in one task keeps that intermediate state out of a
 * paint; without it the intrinsic sizes would be the pre-font heights.
 */
function refresh(): void {
  if (tracked.size === 0) return;

  for (const element of tracked) {
    element.style.contentVisibility = "visible";
  }

  for (const element of tracked) measure(element);
}

function listen(): void {
  if (listening || typeof window === "undefined") return;

  listening = true;

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

  window.addEventListener("load", onFonts);
  window.addEventListener("resize", onResize);

  if (document.fonts) {
    void document.fonts.ready.then(onFonts);
  }

  teardown = () => {
    window.removeEventListener("load", onFonts);
    window.removeEventListener("resize", onResize);

    if (timer !== null) window.clearTimeout(timer);
  };
}

function maybeUnlisten(): void {
  if (tracked.size > 0 || !teardown) return;

  teardown();
  teardown = null;
  listening = false;
}

export function useContentVisibility<T extends HTMLElement>(): RefObject<
  T | null
> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    listen();
    tracked.add(element);
    measure(element);

    return () => {
      tracked.delete(element);
      heights.delete(element);
      maybeUnlisten();
    };
  }, []);

  return ref;
}
