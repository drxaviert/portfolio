import {
  PEEK_FADE_MS,
  RETRACT_EASING,
  REVEAL_EASING,
  type PeekLayout,
} from "./hover-peek";

/**
 * Imperative motion for a hover peek: the pushed card (`--car-x`/`--car-r`, the
 * same registered properties a step uses) and the strip sliding in from the
 * column's edge. Both start from wherever they are drawn now, so a reveal and a
 * retract retarget each other mid-flight instead of snapping.
 */
export type PeekEls = { card: HTMLElement; strip: HTMLElement };

export type PeekTiming = { reveal: number; retract: number; reduce: boolean };

function read(el: HTMLElement, prop: string): number {
  return Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

function showStrip(strip: HTMLElement, layout: PeekLayout) {
  strip.style.width = `${layout.strip.box}px`;
  strip.style.setProperty("--car-r", `${layout.strip.r}px`);
  strip.dataset.clipped = "";
  strip.style.visibility = "visible";
}

/** The pushed card's visible pose right now (mid-tween values included). */
export function pushedPose(
  card: HTMLElement,
  layout: PeekLayout,
): { x: number; w: number } {
  return {
    x: read(card, "--car-x"),
    w: layout.card.restW - read(card, "--car-r"),
  };
}

/** Puts both elements at rest: card unpushed and unclipped, strip hidden. */
export function closeSnap(
  { card, strip }: PeekEls,
  layout: PeekLayout,
  previous: Animation[],
) {
  previous.forEach((animation) => animation.cancel());
  card.style.setProperty("--car-x", `${layout.card.restX}px`);
  card.style.setProperty("--car-r", "0px");
  delete card.dataset.clipped;
  strip.style.visibility = "hidden";
  strip.style.opacity = "";
  delete strip.dataset.clipped;
}

/**
 * Reveals or retracts a peek. Returns the animations so the caller can cancel
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
  const { card, strip } = els;
  const { card: c, strip: s } = layout;

  // A strip that is not shown yet starts from its resting place off the edge.
  const hidden = strip.dataset.clipped === undefined;
  const fromCard = { x: read(card, "--car-x"), r: read(card, "--car-r") };
  const fromStrip = {
    x: hidden ? s.fromX : read(strip, "--car-x"),
    o: hidden ? 0 : Number.parseFloat(getComputedStyle(strip).opacity) || 0,
  };

  previous.forEach((animation) => animation.cancel());
  showStrip(strip, layout);

  const toCard = { x: open ? c.pushX : c.restX, r: open ? c.pushR : 0 };
  const toStrip = { x: open ? s.toX : s.fromX, o: open ? 1 : 0 };

  const finish = () => {
    if (open) return;
    delete card.dataset.clipped;
    strip.style.visibility = "hidden";
    delete strip.dataset.clipped;
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and the fade carries it.
    card.style.setProperty("--car-x", `${toCard.x}px`);
    card.style.setProperty("--car-r", `${toCard.r}px`);
    if (open) card.dataset.clipped = "";
    strip.style.setProperty("--car-x", `${toStrip.x}px`);
    strip.style.opacity = String(toStrip.o);

    const fade = strip.animate(
      { opacity: [fromStrip.o, toStrip.o] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    const cardFade = card.animate(
      { opacity: [0.2, 1] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    fade.onfinish = finish;

    return [fade, cardFade];
  }

  card.dataset.clipped = "";
  strip.style.setProperty("--car-x", `${s.fromX}px`);
  strip.style.opacity = "0";

  const options = {
    duration: open ? timing.reveal : timing.retract,
    easing: open ? REVEAL_EASING : RETRACT_EASING,
    fill: open ? ("forwards" as const) : ("none" as const),
  };

  const cardRun = card.animate(
    {
      "--car-x": [`${fromCard.x}px`, `${toCard.x}px`],
      "--car-r": [`${fromCard.r}px`, `${toCard.r}px`],
    },
    options,
  );
  const stripRun = strip.animate(
    {
      "--car-x": [`${fromStrip.x}px`, `${toStrip.x}px`],
      opacity: [fromStrip.o, toStrip.o],
    },
    options,
  );
  cardRun.onfinish = finish;

  return [cardRun, stripRun];
}
