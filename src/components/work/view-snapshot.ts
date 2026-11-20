"use client";

/**
 * A static copy of a live overlay subtree, for the frame or two a motion needs
 * it after React has already swapped the real one out.
 *
 * The page under the drawer's layout is a router slot, not a frozen element: the
 * layout's `children` is the same slot across `/work` and `/work/<slug>`, and it
 * re-renders with the new route's content in place. Re-rendering the old
 * element would therefore paint the *new* study while an exit animation runs —
 * which is exactly the flash the audit found. Cloning the DOM before the commit
 * is the only frozen copy available.
 *
 * Ids and tab stops are stripped: the copy must never be a second target for
 * `getElementById` or Tab, and it is marked inert and hidden from assistive
 * technology by the caller.
 */
export function snapshotElement<T extends HTMLElement>(element: T): T {
  const clone = element.cloneNode(true) as T;

  for (const node of clone.querySelectorAll<HTMLElement>("[id]")) {
    node.removeAttribute("id");
  }

  for (const node of clone.querySelectorAll<HTMLElement>("[tabindex]")) {
    node.setAttribute("tabindex", "-1");
  }

  for (const node of clone.querySelectorAll<HTMLElement>("[autofocus]")) {
    node.removeAttribute("autofocus");
  }

  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");

  return clone;
}

const SCROLLERS = ".wd-reader-scroll, .wd-index-scroll";

/**
 * Where the reader's and the index's scrollers are, read from the live element.
 * `cloneNode` copies the markup, not the scroll position, so the copy starts at
 * the top unless these are carried across.
 *
 * Read while the source is still in the document: a scroller with no layout box
 * reports `scrollTop` 0, so the same read after the swap would find nothing.
 */
export function readScrollOffsets(element: HTMLElement): number[] {
  return Array.from(
    element.querySelectorAll<HTMLElement>(SCROLLERS),
    (node) => node.scrollTop,
  );
}

/**
 * Put those positions on the copy. The copy must already be in the document:
 * a detached scroller has a scroll height of 0, so the browser clamps every
 * write back to 0 — which is why the cross-fade used to flash the top of a
 * page the visitor had scrolled.
 */
export function writeScrollOffsets(
  copy: HTMLElement,
  offsets: readonly number[],
): void {
  const targets = copy.querySelectorAll<HTMLElement>(SCROLLERS);

  offsets.forEach((top, index) => {
    const target = targets[index];

    if (target) target.scrollTop = top;
  });
}
