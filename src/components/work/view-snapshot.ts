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

/**
 * `cloneNode` copies the markup, not where each scroller was: put the reader's
 * and the index's scroll positions back so a copy never fades out from the top
 * of an article the visitor had scrolled.
 */
export function copyScrollOffsets(from: HTMLElement, to: HTMLElement): void {
  const scrollers = (root: HTMLElement) => [
    ...root.querySelectorAll<HTMLElement>(".wd-reader-scroll, .wd-index-scroll"),
  ];

  const source = scrollers(from);
  const copy = scrollers(to);

  source.forEach((node, index) => {
    const target = copy[index];

    if (target) target.scrollTop = node.scrollTop;
  });
}
