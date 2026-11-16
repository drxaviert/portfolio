import { PEEK_EASING, PEEK_FADE_MS, TURN_EASING } from "./hover-peek";
import type { PeekLayout } from "./hover-peek";

/**
 * Imperative motion for the left hover peek. The whole row moves as one: every
 * visible card's `--car-x` (the registered property a step uses) goes right by
 * the layout's shift, widths untouched, while the previous item's copy slides in
 * from beyond the left edge into the new first slot. The row's edge mask
 * (`--car-fade`, the step's technique: an alpha mask, no painted colour) is
 * present for the whole peek and its strength is animated, in and out, so it
 * never switches on or off.
 *
 * Everything starts from where it is drawn now. An interrupt (a reveal that is
 * retracted half-way, or the reverse) turns round with a shorter, ease-in-out
 * run sized to the distance left, so speed never jumps and nothing restarts
 * from rest.
 */
export type PeekCard = { item: number; el: HTMLElement; restX: number };

export type PeekEls = {
  row: HTMLElement;
  /** The previous item's plain, aria-hidden copy. */
  prev: HTMLElement;
  cards: PeekCard[];
  /** The progressive edge-blur layers, above the row (see the css). */
  blurs: HTMLElement[];
};

export type PeekTiming = {
  reveal: number;
  retract: number;
  reduce: boolean;
  /** Strength of the soft fade on the copy's left end (0 none, 1 full). */
  fade: number;
  /**
   * A step's run supplies its own duration and curve, so the copy arrives with
   * the cards instead of on the peek's own timing (see home-carousel.tsx).
   */
  run?: { duration: number; easing: string };
  /** The caller drives the cards (a step): only the copy, fade and blur move. */
  cards?: boolean;
};

export function read(el: HTMLElement, prop: string): number {
  return Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

/** Each card's pose as drawn this instant, mid-tween values included. */
export function cardPoses(els: PeekEls): Map<number, { x: number; w: number }> {
  return new Map(
    els.cards.map((card) => [
      card.item,
      {
        x: read(card.el, "--car-x"),
        // The width it is drawn at, not the element's box: while a step runs the
        // box is as wide as the wider end and the crop (`--car-r`) holds the
        // rest, so a click mid-glide has to start from the drawn width.
        w: Math.max(
          (Number.parseFloat(card.el.style.width) || 0) -
            read(card.el, "--car-r"),
          1,
        ),
      },
    ]),
  );
}

/** Puts everything at rest: cards unshifted, the copy hidden, no mask. */
export function closeSnap(
  { row, prev, cards, blurs }: PeekEls,
  previous: Animation[],
) {
  previous.forEach((animation) => animation.cancel());
  for (const card of cards)
    card.el.style.setProperty("--car-x", `${card.restX}px`);
  prev.style.visibility = "hidden";
  prev.style.opacity = "";
  delete row.dataset.mask;
  row.style.setProperty("--car-fade", "0");
  // A peek held mid-fade (the reader opened over it) would otherwise leave the
  // edge blur and fade drawn over the row at rest.
  for (const blur of blurs) blur.style.opacity = "0";
}

/**
 * Puts everything in the peek arrangement at once: cards shifted, the copy in
 * its first slot with the left fade, the edge blur and the fade at full
 * strength. A step that lands already peeking uses this, so the end frame of
 * the run and the settled state are the same pixels.
 */
export function openSnap(
  { row, prev, cards, blurs }: PeekEls,
  layout: PeekLayout,
  fade: number,
) {
  cards.forEach((card, index) =>
    card.el.style.setProperty("--car-x", `${layout.cardX[index]}px`),
  );
  prev.style.width = `${layout.prevW}px`;
  prev.style.setProperty("--car-lf", String(fade));
  prev.style.setProperty("--car-x", `${layout.prev.toX}px`);
  prev.style.opacity = "1";
  prev.style.visibility = "visible";
  for (const blur of blurs) blur.style.opacity = "1";
  row.dataset.mask = "";
  row.style.setProperty("--car-fade", "1");
}

/**
 * Reveals or retracts the peek. Returns the animations so the caller can cancel
 * them; `done` runs when a retract has fully finished.
 */
export function tweenPeek(
  els: PeekEls,
  layout: PeekLayout,
  open: boolean,
  timing: PeekTiming,
  previous: Animation[],
  done: () => void,
): Animation[] {
  const { row, prev, cards, blurs } = els;

  // A copy that is not shown yet starts beyond the left edge.
  const fresh = prev.style.visibility !== "visible";
  const fromPrev = {
    x: fresh ? layout.prev.fromX : read(prev, "--car-x"),
    o: fresh ? 0 : Number.parseFloat(getComputedStyle(prev).opacity) || 0,
  };
  const fromCards = cards.map((card) => read(card.el, "--car-x"));
  const fromFade = read(row, "--car-fade");
  // The edge-blur layers ride their cards inside the row, so they fade with the
  // row's hold mask; only their own opacity is animated here.
  const fromBlur = blurs.map(
    (el) => Number.parseFloat(getComputedStyle(el).opacity) || 0,
  );

  previous.forEach((animation) => animation.cancel());
  prev.style.width = `${layout.prevW}px`;
  prev.style.setProperty("--car-lf", String(timing.fade));
  prev.style.visibility = "visible";
  row.dataset.mask = "";

  const toPrev = {
    x: open ? layout.prev.toX : layout.prev.fromX,
    o: open ? 1 : 0,
  };
  const toX = (index: number) =>
    open ? layout.cardX[index] : cards[index].restX;

  const finish = () => {
    if (open) {
      // Pin the blur and the edge fade at full strength once revealed, so the
      // hold never depends on the reveal animations staying alive.
      for (const blur of blurs) blur.style.opacity = "1";
      row.style.setProperty("--car-fade", "1");
      return;
    }
    // The retract's runs end at each card's rest slot but are not filled, so
    // write the rest pose down too: a peek that a step landed in leaves the
    // shifted poses inline (openSnap), and without this the cards would fall
    // back to them - a row stuck one column right of rest with no peek card.
    for (const card of cards)
      card.el.style.setProperty("--car-x", `${card.restX}px`);
    // Clear the pins: with the fade-out animations gone, they must stay where
    // they faded to, not snap back to the pinned values.
    for (const blur of blurs) blur.style.opacity = "0";
    row.style.setProperty("--car-fade", "0");
    prev.style.visibility = "hidden";
    prev.style.opacity = "";
    delete row.dataset.mask;
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and a fade carries it. The
    // edge blur and the edge fade appear with the copy rather than on their own.
    cards.forEach((card, index) =>
      card.el.style.setProperty("--car-x", `${toX(index)}px`),
    );
    prev.style.setProperty("--car-x", `${toPrev.x}px`);
    prev.style.opacity = String(toPrev.o);
    for (const blur of blurs) blur.style.opacity = open ? "1" : "0";
    row.style.setProperty("--car-fade", open ? "1" : "0");

    const prevFade = prev.animate(
      { opacity: [fromPrev.o, toPrev.o] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    const rowFade = row.animate(
      { opacity: [0.2, 1] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    prevFade.onfinish = finish;

    return [prevFade, rowFade];
  }

  prev.style.setProperty("--car-x", `${layout.prev.fromX}px`);
  prev.style.opacity = "1";

  // How much of the shift is left from where the first card is drawn: an
  // interrupt turns round part-way, so the run is shorter and eases in and out
  // instead of restarting with a full-speed kick.
  const left = Math.abs(toX(0) - fromCards[0]) / layout.shift;
  const turning = left > 0.02 && left < 0.98;
  const base = open ? timing.reveal : timing.retract;
  const options = {
    duration:
      timing.run?.duration ??
      (turning ? Math.max(base * left, base * 0.35) : base),
    easing:
      timing.run?.easing ?? (turning ? TURN_EASING : PEEK_EASING),
    fill: open ? ("forwards" as const) : ("none" as const),
  };

  const runs = timing.cards === false
    ? []
    : cards.map((card, index) =>
        card.el.animate(
          { "--car-x": [`${fromCards[index]}px`, `${toX(index)}px`] },
          options,
        ),
      );
  const prevRun = prev.animate(
    { "--car-x": [`${fromPrev.x}px`, `${toPrev.x}px`] },
    options,
  );
  // The row's edge fade ramps in with the reveal and holds at full strength for
  // the rest of the hover; on leave it ramps back to opaque with the retract.
  const maskRun = row.animate(
    { "--car-fade": [fromFade, open ? 1 : 0] },
    options,
  );
  const blurRuns = blurs.map((el, index) =>
    el.animate({ opacity: [fromBlur[index], open ? 1 : 0] }, options),
  );

  prevRun.onfinish = finish;

  return [...runs, prevRun, maskRun, ...blurRuns];
}
