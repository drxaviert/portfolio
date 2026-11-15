import {
  PEEK_FADE_MS,
  RETRACT_EASING,
  REVEAL_EASING,
  type PeekLayout,
} from "./hover-peek";

/**
 * Imperative motion for the left hover peek. The whole row moves as one: every
 * visible card's `--car-x` (the registered property a step uses) goes right by
 * the layout's shift, the strip slides in from the column's edge, and the row's
 * edge mask (`--car-fade`) comes in with them. Everything starts from where it
 * is drawn now, so a reveal and a retract retarget each other mid-flight.
 */
export type PeekCard = {
  item: number;
  el: HTMLElement;
  restX: number;
  /** Blur (px) the card has while the peek is open: the one cut at the edge. */
  blur: number;
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

/** Each card's `--car-x` as drawn this instant, mid-tween values included. */
export function cardXs(els: PeekEls): Map<number, number> {
  return new Map(
    els.cards.map((card) => [card.item, read(card.el, "--car-x")]),
  );
}

/** Puts everything at rest: cards unpushed, mask off, strip hidden. */
export function closeSnap(
  { row, strip, cards }: PeekEls,
  previous: Animation[],
) {
  previous.forEach((animation) => animation.cancel());
  for (const card of cards) {
    card.el.style.setProperty("--car-x", `${card.restX}px`);
    card.el.style.filter = "";
  }
  row.style.removeProperty("--car-fade");
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
  const { strip: s, shift } = layout;

  // A strip that is not shown yet starts from its resting place off the edge.
  const fresh = strip.dataset.clipped === undefined;
  const fromStrip = {
    x: fresh ? s.fromX : read(strip, "--car-x"),
    o: fresh ? 0 : Number.parseFloat(getComputedStyle(strip).opacity) || 0,
  };
  const fromCards = cards.map((card) => ({
    x: read(card.el, "--car-x"),
    filter: getComputedStyle(card.el).filter || "none",
  }));
  const fromFade = read(row, "--car-fade");

  previous.forEach((animation) => animation.cancel());
  showStrip(strip, layout);

  const toStrip = { x: open ? s.toX : s.fromX, o: open ? 1 : 0 };
  const toFade = open ? 1 : 0;
  const toX = (card: PeekCard) => card.restX + (open ? shift : 0);

  const finish = () => {
    if (open) return;
    strip.style.visibility = "hidden";
    delete strip.dataset.clipped;
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and a fade carries it. The
    // mask is static.
    for (const card of cards) {
      card.el.style.setProperty("--car-x", `${toX(card)}px`);
      card.el.style.filter =
        open && card.blur > 0 ? `blur(${card.blur}px)` : "";
    }
    row.style.setProperty("--car-fade", String(toFade));
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
      "--car-x": [`${fromCards[index].x}px`, `${toX(card)}px`],
    };
    if (card.blur > 0) {
      frames.filter = [
        fromCards[index].filter,
        open ? `blur(${card.blur}px)` : "none",
      ];
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
  const fadeRun = row.animate({ "--car-fade": [fromFade, toFade] }, options);

  stripRun.onfinish = finish;

  return [...runs, stripRun, fadeRun];
}
