"use client";

import { useEffect } from "react";
import { CAROUSEL_STEP_END, CAROUSEL_STEP_START } from "./step-events";
import { rectZoom } from "./layout-zoom";

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
    /** The host's frame zoom at the last box read; 1 when it has no layout. */
    let zoom = 1;
    let clientX = 0;
    let clientY = 0;
    let frame = 0;
    // True while the carousel steps: the box can move under a still pointer, so
    // the glow re-reads it every frame until the step ends.
    let following = false;
    // Set by a step ending, so the flush takes one last measurement of the
    // settled box without touching layout from the event handler.
    let needsRead = false;
    const snaps = new WeakMap<HTMLElement, number>();

    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(flush);
      }
    }

    /** Reads a host box and keeps the effective frame zoom that goes with it. */
    function readBox(element: HTMLElement): DOMRect {
      const box = element.getBoundingClientRect();
      zoom = rectZoom(element, box);
      return box;
    }

    function flush() {
      frame = 0;

      if (!glow || !host) {
        return;
      }

      // Read first, then write: the box is measured before any style is written
      // in this frame, so the flush never forces a layout in the middle of its
      // own writes. The box is trusted from activate()/scroll/resize/focus
      // unless a carousel step is running (a card can be moved under a still
      // pointer) or the last step just ended; only then is it re-measured.
      if (following || needsRead) {
        rect = readBox(host);
        needsRead = false;
      }

      if (!rect) {
        return;
      }

      // The glow's transform lives inside the zoomed frame, so the painted
      // pointer offset is divided back into frame px.
      const mx = (clientX - rect.left - rect.width / 2) / zoom;
      const my = (clientY - rect.top - rect.height / 2) / zoom;

      glow.style.setProperty("--ring-mx", `${mx}px`);
      glow.style.setProperty("--ring-my", `${my}px`);

      // Keep following only while a step runs; it stops with the step.
      if (following) {
        schedule();
      }
    }

    function onStepStart() {
      following = true;
      schedule();
    }

    function onStepEnd() {
      following = false;
      // One last read, so the glow lands under the pointer at the settled box.
      needsRead = true;
      schedule();
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
      rect = readBox(next);
      clientX = x;
      clientY = y;

      snapTo(
        glow,
        (x - rect.left - rect.width / 2) / zoom,
        (y - rect.top - rect.height / 2) / zoom,
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
      rect = readBox(entry);
      clientX = targetRect.left + targetRect.width / 2;
      clientY = targetRect.top + targetRect.height / 2;

      snapTo(
        glow,
        (clientX - hostRect.left - hostRect.width / 2) / zoom,
        (clientY - hostRect.top - hostRect.height / 2) / zoom,
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

      rect = readBox(host);
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
    window.addEventListener(CAROUSEL_STEP_START, onStepStart);
    window.addEventListener(CAROUSEL_STEP_END, onStepEnd);

    return () => {
      window.removeEventListener(CAROUSEL_STEP_START, onStepStart);
      window.removeEventListener(CAROUSEL_STEP_END, onStepEnd);
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
