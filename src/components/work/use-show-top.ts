"use client";

import { useEffect, useState } from "react";

/**
 * Whether the reader has been scrolled more than one screen, which is when
 * "↑ Top" earns its place. The threshold is the container's own height, so it
 * reads the same at every viewport without a fixed pixel value.
 *
 * Scroll events fire far more often than the value can change, so the read is
 * coalesced into one animation frame and the listener stays passive: reading
 * `scrollTop` never blocks the scroll itself.
 */
export function useShowTop(scrollEl: HTMLElement | null): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!scrollEl) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      setShow(scrollEl.scrollTop > scrollEl.clientHeight);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollEl]);

  return show;
}
