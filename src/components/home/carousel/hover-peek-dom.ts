import {
  PEEK_FADE_MS,
  RETRACT_EASING,
  REVEAL_EASING,
  type PeekLayout,
} from "./hover-peek";

/**
 * Imperative motion for the left hover peek. The whole row moves as one: every
 * visible card's `--car-x` (the registered property a step uses) goes right by
 * the layout's shift and the strip slides in from the column's edge.
 *
 * Both ends get the same treatment over the same width: the strip is a blurred
 * slice of the previous item, and the card that slips under the right edge is
 * cut away in the column's last `size` px (`data-edge-cut`) where a blurred copy
 * of it (`copy`) rides along, so blur and fade touch only that slice.
 *
 * Everything starts from where it is drawn now, so a reveal and a retract
 * retarget each other mid-flight.
 */
export type PeekCard = {
  item: number;
  el: HTMLElement;
  restX: number;
  /** The card that slips under the right edge. */
  cut: boolean;
};

export type PeekEls = {
  row: HTMLElement;
  strip: HTMLElement;
  /** A plain copy of the cut card; the css clips it to the column's last slice. */
  copy: HTMLElement | null;
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

function showCopy({ copy, cards }: PeekEls) {
  const cut = cards.find((card) => card.cut);
  if (!copy || !cut) return;

  copy.style.width = cut.el.style.width;
  copy.style.visibility = "visible";
  copy.style.opacity = "1";
  cut.el.dataset.edgeCut = "";
}

function hideCopy({ copy, cards }: PeekEls) {
  if (copy) {
    copy.style.visibility = "hidden";
    copy.style.opacity = "";
    copy.style.filter = "";
    copy.style.removeProperty("--car-x");
  }
  for (const card of cards) delete card.el.dataset.edgeCut;
}

/** Each card's `--car-x` as drawn this instant, mid-tween values included. */
export function cardXs(els: PeekEls): Map<number, number> {
  return new Map(
    els.cards.map((card) => [card.item, read(card.el, "--car-x")]),
  );
}

/** Puts everything at rest: cards unpushed, strip and copy hidden. */
export function closeSnap(els: PeekEls, previous: Animation[]) {
  const { strip, cards } = els;

  previous.forEach((animation) => animation.cancel());
  for (const card of cards)
    card.el.style.setProperty("--car-x", `${card.restX}px`);
  hideCopy(els);
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
  const { row, strip, copy, cards } = els;
  const { strip: s, shift } = layout;
  const cutIndex = cards.findIndex((card) => card.cut);

  // A strip that is not shown yet starts from its resting place off the edge.
  const fresh = strip.dataset.clipped === undefined;
  const fromStrip = {
    x: fresh ? s.fromX : read(strip, "--car-x"),
    o: fresh ? 0 : Number.parseFloat(getComputedStyle(strip).opacity) || 0,
  };
  const fromCards = cards.map((card) => ({ x: read(card.el, "--car-x") }));
  const copyFresh = !copy || copy.style.visibility !== "visible";
  const fromCopyFilter =
    copy && !copyFresh ? getComputedStyle(copy).filter || "none" : "none";

  previous.forEach((animation) => animation.cancel());
  showStrip(strip, layout);
  showCopy(els);

  const toStrip = { x: open ? s.toX : s.fromX, o: open ? 1 : 0 };
  const toX = (card: PeekCard) => card.restX + (open ? shift : 0);
  const toBlur = open ? `blur(${layout.blur}px)` : "none";

  const finish = () => {
    if (open) return;
    strip.style.visibility = "hidden";
    delete strip.dataset.clipped;
    hideCopy(els);
    done();
  };

  if (timing.reduce) {
    // No movement: the final state is set at once and a fade carries it.
    for (const card of cards)
      card.el.style.setProperty("--car-x", `${toX(card)}px`);
    if (copy && cutIndex >= 0) {
      copy.style.setProperty("--car-x", `${toX(cards[cutIndex])}px`);
      copy.style.filter = open ? toBlur : "";
    }
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

  const runs = cards.map((card, index) =>
    card.el.animate(
      { "--car-x": [`${fromCards[index].x}px`, `${toX(card)}px`] },
      options,
    ),
  );
  // The copy rides the cut card exactly and gains the strip's blur as it goes.
  if (copy && cutIndex >= 0) {
    runs.push(
      copy.animate(
        {
          "--car-x": [
            `${fromCards[cutIndex].x}px`,
            `${toX(cards[cutIndex])}px`,
          ],
          filter: [fromCopyFilter, toBlur],
        },
        options,
      ),
    );
  }
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
