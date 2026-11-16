/**
 * The scroll ruler's arithmetic, kept out of the component so it can be read
 * and tested without a layout: how heading text becomes an id, how many ticks
 * a study earns, and which tick each section sits on.
 */

/** The reference ruler's density; also the floor for studies with few sections. */
export const RULER_MIN_TICKS = 17;

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Heading text to an id: lowercase, no diacritics, runs of anything else as one
 * dash. Everything a `##` in the studies is likely to hold (apostrophes, an
 * ampersand, a slash) collapses instead of producing an invalid selector.
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

/**
 * De-duplicates ids across one study, in reading order: "The system" twice
 * becomes `the-system` and `the-system-2`. `used` is owned by the caller so a
 * re-measure keeps the ids it already handed out.
 */
export function uniqueHeadingId(text: string, used: Set<string>): string {
  const base = slugifyHeading(text);
  let id = base;
  let suffix = 2;

  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  used.add(id);
  return id;
}

/**
 * One tick per section, never fewer than the reference ruler's 17: past 17
 * sections the grid grows instead of packing two sections onto one tick.
 */
export function rulerTickCount(sectionCount: number): number {
  return Math.max(RULER_MIN_TICKS, sectionCount);
}

/**
 * Each section's start (0–1 of the scrollable height) to a tick index. The
 * nearest index wins; if an earlier section already holds it, the search moves
 * outward, nearer first, so two sections can never share a mark and the order
 * on the ruler stays the reading order.
 */
export function placeSectionTicks(
  progress: number[],
  tickCount: number,
): number[] {
  const count = Math.max(1, tickCount);
  const taken = new Array<boolean>(count).fill(false);

  return progress.map((value) => {
    const want = Math.round(clamp01(value) * (count - 1));

    for (let distance = 0; distance < count; distance += 1) {
      for (const index of [want - distance, want + distance]) {
        if (index >= 0 && index < count && !taken[index]) {
          taken[index] = true;
          return index;
        }
      }
    }

    return want;
  });
}

/** The section closest to a raw progress value; -1 when there are none. */
export function nearestSection(progress: number[], value: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  progress.forEach((section, index) => {
    const distance = Math.abs(section - value);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });

  return best;
}

/** A block's extent in scroll positions: where a jump to it would land. */
export type BlockSpan = { top: number; bottom: number };

/**
 * Where a block starts and ends once its scroll-margin is honoured: a jump
 * lands `clearance` above the block's own top, so the whole span moves with it.
 * Applying the shift to the top only would let a long block claim the start of
 * the one after it.
 */
export function blockSpan(
  top: number,
  height: number,
  clearance: number,
): BlockSpan {
  return { top: top - clearance, bottom: top + height - clearance };
}

/**
 * The tick a pointer height lands on. Ticks are a grid, so the nearest row
 * wins: there is no dead gap between two marks, which is what lets the pointer
 * scrub the column.
 */
export function tickAt(fraction: number, tickCount: number): number {
  if (tickCount <= 0) return -1;

  return Math.round(clamp01(fraction) * (tickCount - 1));
}

/**
 * The block that sits at a scroll position: whatever covers it, else the
 * nearest edge. That second case is the gap between two blocks (a figure's
 * margin, a heading's lead-in), where the reader is still looking at one of
 * them.
 */
export function pickBlock(spans: BlockSpan[], position: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  spans.forEach((span, index) => {
    const distance =
      position < span.top
        ? span.top - position
        : position > span.bottom
          ? position - span.bottom
          : 0;

    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });

  return best;
}

/** One line of text from markup: runs of whitespace become one space. */
export function collapseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
