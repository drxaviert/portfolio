import {
  PEEK_FADE_MS,
  RETRACT_EASING,
  REVEAL_EASING,
  type PeekLayout,
} from "./hover-peek";

/**
 * Imperative motion for the left hover peek. The whole row moves as one: every
 * visible card goes to its peek pose along the registered `--car-x` and
 * `--car-r` (position and crop, the same properties a step uses), and the strip
 * slides in from the column's edge. Widths are never animated: a card that
 * needs a wider visible box gets that box once, at the start, and the crop
 * does the rest, so content never reflows.
 *
 * The last card is the right-hand end shape: it slides under the column edge
 * until only the peek width shows, and gains the same blur and fade as the
 * left strip (`data-peek-end`, `--car-pe`).
 *
 * Everything starts from where it is drawn now, so a reveal and a retract
 * retarget each other mid-flight.
 */
export type PeekCard = {
  item: number;
  el: HTMLElement;
  restX: number;
  restW: number;
  /** The last card: the right-hand end shape. */
  end: boolean;
};

export type PeekEls = {
  row: HTMLElement;
  strip: HTMLElement;
  cards: PeekCard[];
};

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

/** Gives every card the box its peek pose needs, with a crop that looks like rest. */
function prepareCards({ cards }: PeekEls, layout: PeekLayout) {
  cards.forEach((card, index) => {
    const { box } = layout.cards[index];

    card.el.style.width = `${box}px`;
    card.el.style.setProperty("--car-r", `${box - card.restW}px`);
    card.el.dataset.clipped = "";
    if (card.end) card.el.dataset.peekEnd = "";
  });
}

function restoreCards({ cards }: PeekEls) {
  for (const card of cards) {
    card.el.style.width = `${card.restW}px`;
    card.el.style.setProperty("--car-x", `${card.restX}px`);
    card.el.style.setProperty("--car-r", "0px");
    card.el.style.removeProperty("--car-pe");
    card.el.style.filter = "";
    delete card.el.dataset.clipped;
    delete card.el.dataset.peekEnd;
  }
}

/** Each card's pose as drawn this instant, mid-tween values included. */
export function cardPoses(els: PeekEls): Map<number, { x: number; w: number }> {
  return new Map(
    els.cards.map((card) => [
      card.item,
      {
        x: read(card.el, "--car-x"),
        w: Number.parseFloat(card.el.style.width) - read(card.el, "--car-r"),
      },
    ]),
  );
}

/** Puts everything at rest: cards unpushed, strip hidden. */
export function closeSnap(els: PeekEls, previous: Animation[]) {
  const { strip } = els;

  previous.forEach((animation) => animation.cancel());
  restoreCards(els);
  strip.style.visibility = "hidden";
  strip.style.opacity = "";
  delete strip.dataset.clipped;
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
  const { row, strip, cards } = els;
  const { strip: s } = layout;

  // A strip that is not shown yet starts from its resting place off the edge.
  const fresh = strip.dataset.clipped === undefined;
  const fromStrip = {
    x: fresh ? s.fromX : read(strip, "--car-x"),
    o: fresh ? 0 : Number.parseFloat(getComputedStyle(strip).opacity) || 0,
  };
  const from = cards.map((card, index) => ({
    x: read(card.el, "--car-x"),
    // Before the first reveal a card sits at rest, whatever its inline crop.
    r:
      card.el.dataset.clipped === undefined
        ? layout.cards[index].box - card.restW
        : read(card.el, "--car-r"),
    pe: read(card.el, "--car-pe"),
    filter: getComputedStyle(card.el).filter || "none",
    box: layout.cards[index].box,
  }));

  previous.forEach((animation) => animation.cancel());
  showStrip(strip, layout);
  prepareCards(els, layout);

  const toStrip = { x: open ? s.toX : s.fromX, o: open ? 1 : 0 };
  const to = cards.map((card, index) => {
    const pose = layout.cards[index];
    return open
      ? { x: pose.x, r: pose.box - pose.w }
      : { x: card.restX, r: pose.box - card.restW };
  });
  const endBlur = open ? `blur(${layout.blur}px)` : "none";

  const finish = () => {
    if (open) return;
    strip.style.visibility = "hidden";
    delete strip.dataset.clipped;
    restoreCards(els);
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and a fade carries it.
    cards.forEach((card, index) => {
      card.el.style.setProperty("--car-x", `${to[index].x}px`);
      card.el.style.setProperty("--car-r", `${to[index].r}px`);
      if (card.end) {
        card.el.style.setProperty("--car-pe", open ? "1" : "0");
        card.el.style.filter = open ? endBlur : "";
      }
    });
    strip.style.setProperty("--car-x", `${toStrip.x}px`);
    strip.style.opacity = String(toStrip.o);

    const stripFade = strip.animate(
      { opacity: [fromStrip.o, toStrip.o] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    const rowFade = row.animate(
      { opacity: [0.2, 1] },
      { duration: PEEK_FADE_MS, easing: "linear" },
    );
    stripFade.onfinish = finish;

    return [stripFade, rowFade];
  }

  strip.style.setProperty("--car-x", `${s.fromX}px`);
  strip.style.opacity = "0";

  const options = {
    duration: open ? timing.reveal : timing.retract,
    easing: open ? REVEAL_EASING : RETRACT_EASING,
    fill: open ? ("forwards" as const) : ("none" as const),
  };

  const runs = cards.map((card, index) => {
    const frames: PropertyIndexedKeyframes = {
      "--car-x": [`${from[index].x}px`, `${to[index].x}px`],
      "--car-r": [`${from[index].r}px`, `${to[index].r}px`],
    };
    if (card.end) {
      frames["--car-pe"] = [from[index].pe, open ? 1 : 0];
      frames.filter = [from[index].filter, endBlur];
    }
    return card.el.animate(frames, options);
  });
  const stripRun = strip.animate(
    {
      "--car-x": [`${fromStrip.x}px`, `${toStrip.x}px`],
      opacity: [fromStrip.o, toStrip.o],
    },
    options,
  );

  stripRun.onfinish = finish;

  return [...runs, stripRun];
}
