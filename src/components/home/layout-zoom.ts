/**
 * The effective CSS `zoom` between an element's layout box and the screen.
 *
 * The home frame is scaled with `zoom: var(--fit)` on short viewports. The
 * layout, `offsetWidth` and every px length written inside the frame stay in
 * the frame's own (pre-zoom) space, while `getBoundingClientRect()` reports
 * the painted, zoomed box. Code that measures a box and then writes a px
 * length back into the same subtree has to convert between the two, or the
 * zoom is applied twice.
 *
 * `offsetWidth` is the layout width and is not affected by zoom; the rect is.
 * Their ratio is the effective zoom. Elements with no layout width (jsdom,
 * a display:none host) report 1, which keeps tests and unzoomed pages exact.
 */
export function rectZoom(
  element: HTMLElement,
  rect: Pick<DOMRect, "width">,
): number {
  const width = element.offsetWidth;

  if (width <= 0 || rect.width <= 0) return 1;

  return rect.width / width;
}

/** The element's zoom, measuring its box. Prefer rectZoom when a rect exists. */
export function layoutZoom(element: HTMLElement): number {
  return rectZoom(element, element.getBoundingClientRect());
}
