# Reader scroll ruler: design (short)

**Intent.** Dat wants a tick-mark scroll ruler on the study reader that works as **section navigation you can hover and click**. The reference is his screenshot: a column of fine grey ticks at the right edge of a dark page, with one longer, brighter tick marking the current position.

**Approaches.**
- A: one tick per `##` section, placed proportionally. Rejected: with 4 sections it is too sparse to have the reference's ruler texture.
- B (picked by Dat): a dense, evenly spaced ruler with the section ticks marked.
- C: a progress bar with section dots. Not proposed, since it doesn't match the reference.

**Design (B).**
- Placement: fixed to the right edge of the reader's scroll area (`#wd-reader-scroll`, reader.tsx:47), vertically centred, outside the text measure.
- Ticks: ~17 evenly spaced fine ticks (short, low-contrast grey). Each of the 4 `##` sections gets the regular tick nearest to its start position (its offset ÷ scrollable height), drawn slightly longer.
- Position indicator: one long, bright tick at the current scroll progress. It is tied to scroll position (scroll-driven, transform only), so it moves with scrolling rather than on a timer.
- Hover: hovering the ruler highlights the nearest section tick and shows that section's heading as a small label to its left.
- Click: clicking a section tick, or near one, scrolls the reader smoothly so that heading is at the top. Under reduced motion it jumps instantly.
- Accessibility: wrapped in `<nav aria-label="Sections">`. Each section tick is a link to the heading's id and is keyboard focusable, with a visible focus ring that shows the label. Decorative ticks are `aria-hidden`.
- Mobile/touch: hidden under `(hover: none)` and phone widths.
- Theme: uses existing tokens for Day and Night; no new colours beyond the current grey and on-surface tokens.
- Motion: no entrance choreography of its own. It appears with the reader's existing entrance cascade (last group) and must not change existing timings.

**Works for any study without setup (Dat).**
- The ruler builds itself from whatever the study contains. Adding a new `content/work/<slug>.mdx` gets a working ruler with no config, no per-study code and no hand-placed ticks.
- Sections come from the rendered `##` headings, read at runtime from the reader DOM, with ids generated from the heading text (slugified, de-duplicated).
- Tick positions are measured from the actual layout and re-measured on resize, font load and image load (ResizeObserver on the scroll content).
- Any section count works:
  - 0–1 headings: progress tick only, no section marks.
  - Many headings: the tick count grows so that every section gets its own tick, with a minimum gap between ticks. If sections would collide, the nearest free tick is used.
- Any length works: a short study that doesn't scroll shows no ruler.
- Tests cover a fixture with 0, 1, 4 and 12 sections, plus a short non-scrolling study.

**Non-goals.** No progress percentage, no per-tick labels always visible, and no change to the reader's layout width.

**Left to the builder.**
- Exact tick count and spacing within the ~15–20 range.
- How heading ids are generated, if the MDX headings don't have them yet.
- Hit-area size: the full ruler column is hoverable and snaps to the nearest section.
