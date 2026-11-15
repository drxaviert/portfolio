import { EDGE_KEYFRAMES } from "./blur-mode";
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
};

export type PeekTiming = {
  reveal: number;
  retract: number;
  reduce: boolean;
  /** Strength of the soft fade on the copy's left end (0 none, 1 full). */
  fade: number;
};

export function read(el: HTMLElement, prop: string): number {
  return Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

/** The blur (px) an element is drawn with right now. */
export function blurNow(el: HTMLElement): number {
  const match = /blur\(([\d.]+)px\)/.exec(getComputedStyle(el).filter);
  return match ? Number.parseFloat(match[1]) : 0;
}

/** Each card's pose as drawn this instant, mid-tween values included. */
export function cardPoses(els: PeekEls): Map<number, { x: number; w: number }> {
  return new Map(
    els.cards.map((card) => [
      card.item,
      {
        x: read(card.el, "--car-x"),
        w: Number.parseFloat(card.el.style.width),
      },
    ]),
  );
}

/** Puts everything at rest: cards unshifted, the copy hidden, no mask. */
export function closeSnap(
  { row, prev, cards }: PeekEls,
  previous: Animation[],
) {
  previous.forEach((animation) => animation.cancel());
  for (const card of cards)
    card.el.style.setProperty("--car-x", `${card.restX}px`);
  prev.style.visibility = "hidden";
  prev.style.opacity = "";
  delete row.dataset.mask;
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
  const { row, prev, cards } = els;

  // A copy that is not shown yet starts beyond the left edge.
  const fresh = prev.style.visibility !== "visible";
  const fromPrev = {
    x: fresh ? layout.prev.fromX : read(prev, "--car-x"),
    o: fresh ? 0 : Number.parseFloat(getComputedStyle(prev).opacity) || 0,
  };
  const fromCards = cards.map((card) => read(card.el, "--car-x"));
  const fromFade = read(row, "--car-fade");

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
    if (open) return;
    prev.style.visibility = "hidden";
    prev.style.opacity = "";
    delete row.dataset.mask;
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and a fade carries it.
    cards.forEach((card, index) =>
      card.el.style.setProperty("--car-x", `${toX(index)}px`),
    );
    prev.style.setProperty("--car-x", `${toPrev.x}px`);
    prev.style.opacity = String(toPrev.o);

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
    duration: turning ? Math.max(base * left, base * 0.35) : base,
    easing: turning ? TURN_EASING : PEEK_EASING,
    fill: open ? ("forwards" as const) : ("none" as const),
  };

  const runs = cards.map((card, index) =>
    card.el.animate(
      { "--car-x": [`${fromCards[index]}px`, `${toX(index)}px`] },
      options,
    ),
  );
  const prevRun = prev.animate(
    { "--car-x": [`${fromPrev.x}px`, `${toPrev.x}px`] },
    options,
  );
  // The edge mask's strength rises and falls smoothly over the run, from
  // whatever it is now: never a switch.
  const maskRun = row.animate(
    EDGE_KEYFRAMES.map((k, index) => ({
      offset: k.offset,
      easing: k.easing,
      "--car-fade": index === 0 ? fromFade : k.fade,
    })),
    { duration: options.duration, easing: "linear" },
  );

  prevRun.onfinish = finish;

  return [...runs, prevRun, maskRun];
}
