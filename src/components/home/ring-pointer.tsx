"use client";

import { useEffect } from "react";

const HOST = ".ring-host";
const GLOW = ".ring-glow";

/**
 * Keeps the ring glow under the pointer, or under the focused control.
 *
 * Writes --ring-mx / --ring-my on the .ring-glow itself rather than the host:
 * a custom property set on the host is inherited by every child, so writing it
 * per pointer move invalidates style for the whole card (224 cells on the
 * tracker). One document listener, no React state, and the writes are coalesced
 * into requestAnimationFrame.
 *
 * Entering a host or focusing a control inside one snaps the glow to that point
 * with a 0ms follow for one frame, so the light starts under the input instead
 * of sliding in from wherever the last visit left it.
 */
export function RingHoverPointer() {
  useEffect(() => {
    let host: HTMLElement | null = null;
    let glow: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let clientX = 0;
    let clientY = 0;
    let frame = 0;
    const snaps = new WeakMap<HTMLElement, number>();

    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(flush);
      }
    }

    function flush() {
      frame = 0;

      if (!glow || !rect) {
        return;
      }

      glow.style.setProperty(
        "--ring-mx",
        `${clientX - rect.left - rect.width / 2}px`,
      );
      glow.style.setProperty(
        "--ring-my",
        `${clientY - rect.top - rect.height / 2}px`,
      );
    }

    function snapTo(node: HTMLElement, x: number, y: number) {
      const generation = (snaps.get(node) ?? 0) + 1;

      snaps.set(node, generation);
      node.style.setProperty("--ring-follow", "0ms");
      node.style.setProperty("--ring-mx", `${x}px`);
      node.style.setProperty("--ring-my", `${y}px`);

      // Restore the decided follow duration after the snapped position paints.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (snaps.get(node) === generation) {
            node.style.removeProperty("--ring-follow");
          }
        });
      });
    }

    function activate(element: Element, x: number, y: number) {
      const next = element.closest<HTMLElement>(HOST);
      const nextGlow = next?.querySelector<HTMLElement>(GLOW);

      if (!next || !nextGlow) {
        return;
      }

      host = next;
      glow = nextGlow;
      rect = host.getBoundingClientRect();
      clientX = x;
      clientY = y;

      snapTo(
        glow,
        x - rect.left - rect.width / 2,
        y - rect.top - rect.height / 2,
      );
      schedule();
    }

    function onPointerEnter(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const entry = target.closest<HTMLElement>(HOST);

      if (!entry) {
        return;
      }

      // Only a new host: pointerenter also fires moving between its children.
      if (entry === host) {
        return;
      }

      activate(entry, event.clientX, event.clientY);
    }

    function onPointerMove(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const entry = target.closest<HTMLElement>(HOST);

      if (!entry) {
        return;
      }

      if (entry !== host || !glow || !rect) {
        activate(entry, event.clientX, event.clientY);
        return;
      }

      clientX = event.clientX;
      clientY = event.clientY;
      schedule();
    }

    function onFocusIn(event: FocusEvent) {
      const target = event.target;

      if (!(target instanceof Element) || !target.matches(":focus-visible")) {
        return;
      }

      const entry = target.closest<HTMLElement>(HOST);
      const entryGlow = entry?.querySelector<HTMLElement>(GLOW);

      if (!entry || !entryGlow) {
        return;
      }

      const hostRect = entry.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      host = entry;
      glow = entryGlow;
      rect = hostRect;
      clientX = targetRect.left + targetRect.width / 2;
      clientY = targetRect.top + targetRect.height / 2;

      snapTo(
        glow,
        clientX - hostRect.left - hostRect.width / 2,
        clientY - hostRect.top - hostRect.height / 2,
      );
    }

    function onPointerLeave(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const entry = target.closest<HTMLElement>(HOST);

      if (!entry || entry !== host) {
        return;
      }

      const next = event.relatedTarget;

      // Ignore child-to-child moves; only clear when the host is left.
      if (next instanceof Node && entry.contains(next)) {
        return;
      }

      host = null;
      glow = null;
      rect = null;
    }

    function refreshRect() {
      if (!host) {
        return;
      }

      rect = host.getBoundingClientRect();
      schedule();
    }

    document.addEventListener("pointerenter", onPointerEnter, true);
    document.addEventListener("pointerleave", onPointerLeave, true);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", refreshRect, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", refreshRect);

    return () => {
      document.removeEventListener("pointerenter", onPointerEnter, true);
      document.removeEventListener("pointerleave", onPointerLeave, true);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", refreshRect, true);
      window.removeEventListener("resize", refreshRect);

      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return null;
}
