"use client";

import { useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { RingLayers } from "../ring-hover";
import { EDGE_KEYFRAMES } from "./edge-blur";
import { restStyle, playEntity } from "./carousel-dom";
import {
  EMPTY_GEOMETRY,
  GAP,
  VISIBLE_SLOTS,
  advance,
  clickAction,
  RETARGET_BEZIER,
  bezierSpec,
  easeSpec,
  edgeLeftKeys,
  entityKey,
  keyStep,
  restEntities,
  retarget,
  sampleEntities,
  slotOf,
  slotOrder,
  slotPose,
  stepMode,
} from "./carousel-math";
import type { Ease, Entity, Geometry, TitleTiming } from "./carousel-math";
import { CarouselTuner, DEFAULT_SETTINGS } from "./carousel-tuner";
import {
  cardPoses,
  closeSnap,
  openSnap,
  read,
  tweenPeek,
} from "./hover-peek-dom";
import type { PeekCard, PeekEls } from "./hover-peek-dom";
import {
  inZone,
  movedItems,
  peekItem as peekOf,
  peekLayout,
  useHoverCapable,
} from "./hover-peek";
import type { PeekLayout } from "./hover-peek";
import {
  OVERLAY_CLOSING_EVENT,
  OVERLAY_OPENED_EVENT,
} from "@/components/work/overlay-exit";
import { announceStep } from "../step-events";
import "../home-cards.css";
import "./home-carousel.css";

export type CarouselItem =
  | { kind: "work"; slug: string; title: string; cover: WorkMeta["cover"] }
  | { kind: "placeholder"; title: string };

type Tween = {
  entities: Entity[];
  t0: number;
  duration: number;
  ease: Ease;
  timing: TitleTiming;
  animations: Animation[];
  /** True for a released run gliding to rest (see settle). */
  settling?: boolean;
  /** True when this run lands in the hover peek's arrangement, not at rest. */
  peek?: boolean;
};

type PeekState = {
  open: boolean;
  anims: Animation[];
  timer: number | null;
  els: PeekEls | null;
  layout: PeekLayout | null;
  /** Held at its drawn pose while the reader opens over it. */
  frozen: boolean;
};

function idlePeek(): PeekState {
  return {
    open: false,
    anims: [],
    timer: null,
    els: null,
    layout: null,
    frozen: false,
  };
}

const FALLBACK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const CROSSFADE_MS = 120;
/** How long a released step waits for a slow navigation before it lets go. */
const HELD_GRACE_MS = 1500;
/** How long a step that is released mid-flight takes to glide to rest. */
const SETTLE_MS = 350;
const NO_ITEMS: readonly number[] = [];

/** Whether the reader is open (or about to be) over the page. */
function overlayPresent(): boolean {
  return (
    window.location.pathname.startsWith("/work/") ||
    document.querySelector(".wd-expand-layer") !== null
  );
}
const CROSSFADE_FROM = 0.6;
const TITLE_OUT_END = 0.12;

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/** The query string, read on the client only so the page stays static. */
function useLocationSearch(): string {
  return useSyncExternalStore(
    subscribeToLocation,
    () => window.location.search,
    () => "",
  );
}

function supportsLinearEasing(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timing-function", "linear(0, 1)")
  );
}

/**
 * Puts the row's left edge on a whole device pixel. The column is centred, so
 * at an odd viewport width it starts half a pixel in, and every edge anchored
 * to it (the clip, the cards' column-edge masks, the hover band) then splits a
 * pixel. There the right edge's blur copy - its own layer, which the compositor
 * snaps to whole pixels apart from the card's mask - showed through as a 1px
 * line. Shifting the row by that fraction (`left`: it is relative) keeps every
 * card, mask and anchor where it was relative to the row.
 */
function snapRow(row: HTMLElement) {
  row.style.left = "";
  const left = row.getBoundingClientRect().left;
  const ratio = window.devicePixelRatio || 1;
  const shift = Math.round(left * ratio) / ratio - left;
  if (Math.abs(shift) > 0.001) row.style.left = `${shift}px`;
}

function measureGeometry(
  row: HTMLElement,
  guide: HTMLElement,
): Geometry | null {
  const rowRect = row.getBoundingClientRect();
  if (rowRect.width === 0) return null;

  const slots = Array.from(guide.children)
    .slice(0, VISIBLE_SLOTS)
    .map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.left - rowRect.left, w: rect.width };
    });

  return { slots, rowWidth: rowRect.width, gap: GAP };
}

function isModified(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

type SlideProps = {
  item: CarouselItem;
  index: number;
  slot: number;
  total: number;
  ghost: boolean;
  /** The hover peek's strip: the previous item, as a plain inert copy. */
  peek?: boolean;
  /**
   * The card that was the peek's right edge before this step and is leaving:
   * it keeps the edge treatment for the run, fading out with it.
   */
  peekOut?: boolean;
  /**
   * The featured card this step pushes out through the left end: it slides out
   * at its own width with the peek's left edge (fade + blur copy) on the run.
   */
  edgeLeft?: boolean;
  /**
   * A card a run can take across the column's right edge (the right-most slot,
   * a card coming in from or going out past it, a seam copy): it carries the
   * right edge's column-anchored fade and blur copy (home-carousel.css).
   */
  crossRight?: boolean;
  register: (key: string, element: HTMLElement | null) => void;
  onActivate: (event: MouseEvent<HTMLElement>, index: number) => void;
};

/**
 * One card. The ghost is the same card as plain DOM (no link, no focus, hidden
 * from assistive tech) that stands in at the far end of a wrap.
 */
function Slide({
  item,
  index,
  slot,
  total,
  ghost,
  peek = false,
  peekOut = false,
  edgeLeft = false,
  crossRight = false,
  register,
  onActivate,
}: SlideProps) {
  const first = slot === 0 && !ghost;
  const offscreen = slot >= VISIBLE_SLOTS;
  const key = peek ? "peekL" : `${ghost ? "g" : "m"}${index}`;
  const hostClass = "car-host ring-host rounded-lg";
  // The peek's outer edges carry the blur: the copy's left edge, and the
  // right-most visible card's right edge (slot 2, once the 4th has been pushed
  // out). The layer rides the card, so the row's hold mask fades it with the
  // card, its ring and its shadow. The card that held the right edge before a
  // step keeps it while it leaves, so the two hand it over on one run, and a
  // card leaving through the left end takes the peek's left edge for its run.
  const rightEdge =
    !ghost && (slot === VISIBLE_SLOTS - 2 || peekOut);
  // A card leaving through the left end is not the right edge this run, even
  // when its slot after the wrap is the right-most one (a short ring).
  const edgeBlur = peek || edgeLeft ? "left" : rightEdge ? "right" : null;

  // The blurred picture an edge-blur layer masks (the filter is on this copy,
  // the mask on its wrapper: Chromium paints neither if one element has both).
  const blurCopy = (
    <span className="car-peek-blur-copy">
      <span className="car-content">
        {item.kind === "work" ? (
          <>
            <span className="absolute inset-0 overflow-hidden">
              <Cover scene={item.cover} fit="cover" />
            </span>
            <span className="card-fade pointer-events-none absolute inset-8 z-[1] rounded-[8px]" />
          </>
        ) : (
          // A placeholder has no picture, but it still has a card face:
          // blur the surface itself so its edge melts like the others.
          <span
            data-peek-surface=""
            className="bg-surface-container-low absolute inset-0"
          />
        )}
      </span>
    </span>
  );

  const body = (
    <>
      <RingLayers fill="bg-surface-container-low" />
      <div className="car-clip rounded-lg">
        <div className="car-content">
          {item.kind === "work" ? (
            <>
              <div
                aria-hidden="true"
                data-car-cover=""
                className="absolute inset-0 overflow-hidden"
              >
                <Cover scene={item.cover} fit="cover" />
              </div>
              <span
                aria-hidden="true"
                className="card-fade pointer-events-none absolute inset-8 z-[1] rounded-[8px]"
              />
            </>
          ) : null}
          <div
            data-car-title=""
            data-work-card-title={
              first && item.kind === "work" ? "" : undefined
            }
            role={first ? "heading" : undefined}
            aria-level={first ? 1 : undefined}
            className={`ring-title car-title text-balance text-title-sm font-semibold md:text-title ${
              item.kind === "placeholder" ? "text-on-surface-variant" : ""
            }`}
          >
            {item.title}
          </div>
        </div>
        {edgeBlur ? (
          <span
            aria-hidden="true"
            data-peek-blur=""
            data-edge={edgeBlur}
            className="car-peek-blur"
          >
            {blurCopy}
          </span>
        ) : null}
        {crossRight ? (
          // The right end's progressive blur, anchored to the column's edge
          // (home-carousel.css): dense where the card crosses it, thinning
          // inward. Its strength is in its own mask, so the peek never drives it.
          <span
            aria-hidden="true"
            data-cross-blur=""
            className="car-peek-blur car-cross-blur"
          >
            {blurCopy}
          </span>
        ) : null}
      </div>
    </>
  );

  let host;

  if (ghost) {
    host = <div className={hostClass}>{body}</div>;
  } else if (item.kind === "work") {
    host = (
      <Link
        href={`/work/${item.slug}`}
        data-work-card={first ? item.slug : undefined}
        className={hostClass}
        onClick={(event) => onActivate(event, index)}
      >
        {body}
      </Link>
    );
  } else {
    host = (
      <button
        type="button"
        aria-disabled={first || undefined}
        className={hostClass}
        onClick={(event) => onActivate(event, index)}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      ref={(element) => register(key, element)}
      role="group"
      aria-roledescription="slide"
      aria-label={`${slot + 1} of ${total}: ${item.title}`}
      aria-hidden={ghost || undefined}
      inert={(ghost || offscreen) && !peek}
      data-slot={slot}
      data-ghost={ghost ? "" : undefined}
      data-offscreen={offscreen ? "" : undefined}
      data-side={peek ? "left" : undefined}
      data-peek-out={peekOut ? "" : undefined}
      data-edge-left={edgeLeft ? "" : undefined}
      data-cross-right={crossRight ? "" : undefined}
      className={peek ? "car-slide car-peek car-peek-edge" : "car-slide"}
    >
      {/* The masked box for the peek's edge fade: at rest it is the card's box,
          and while peeking it grows by the shadow's reach so the mask can paint
          the shadow as well (see home-carousel.css). */}
      <div className="car-frame">{host}</div>
    </div>
  );
}

/**
 * The home page's middle row from md up: a stepped, endless carousel of
 * `items`, four slots wide. Nothing moves on its own; a step is a click on a
 * card or an arrow key.
 *
 * A card is laid out at the wide slot's width and only cropped to its slot, so
 * its content never reflows while a step runs (see carousel-dom.ts). Item
 * motion is planned in carousel-math.ts; this component wires it to the DOM.
 */
export function HomeCarousel({ items }: { items: CarouselItem[] }) {
  const n = items.length;
  const reduce = useReducedMotion() ?? false;
  const search = useLocationSearch();
  const hoverCapable = useHoverCapable();
  const tune = new URLSearchParams(search).get("tune") === "1";

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // `offset` is the target: labels, slots and the announcement follow it at
  // once. `domOffset` is the order the DOM is in, which only changes between
  // steps so a moving card is never re-parented mid-tween.
  const [offset, setOffset] = useState(0);
  const [domOffset, setDomOffset] = useState(0);
  const [ghosts, setGhosts] = useState<number[]>([]);
  /**
   * The item that was the peek's right edge when the running step started: it
   * keeps the edge treatment while it leaves. It has to be state rather than a
   * function of `domOffset`, because a click during a glide re-aims the run at
   * another arrangement before the DOM order has caught up.
   */
  const [peekOut, setPeekOut] = useState<number | null>(null);
  /**
   * The cards the running step pushes out through the left end (the feature,
   * and the cards after it on a step of two or three): each carries the peek's
   * left edge (fade + blur copy) while it leaves.
   */
  const [edgeLeft, setEdgeLeft] = useState<readonly number[]>(NO_ITEMS);
  const [announcement, setAnnouncement] = useState("");
  const [settled, setSettled] = useState(0);
  /** Measured slot widths, so the edge-blur layers can size their ramps. */
  const [slotWidths, setSlotWidths] = useState<number[] | null>(null);

  const rowRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const geometry = useRef<Geometry>(EMPTY_GEOMETRY);
  const offsetRef = useRef(0);
  const tween = useRef<Tween | null>(null);
  const focusFirst = useRef(false);
  const latest = useRef({ settings, reduce });
  const peek = useRef<PeekState>(idlePeek());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  // The row's box for the hover zone. It is read lazily, once, after anything
  // that can move it (a scroll, a resize, a step ending, a peek changing state),
  // never once per pointer move.
  // Set while motion is held for the reader (see freezeMotion). If the reader
  // never reports back (a hard back navigation unmounts it), this is how the
  // carousel finds out and lets go.
  const held = useRef<{ at: number } | null>(null);
  const zone = useRef<{ rect: DOMRect | null; dirty: boolean }>({
    rect: null,
    dirty: true,
  });
  const hoverApi = useRef({
    evaluate: () => {},
    close: () => {},
    release: () => {},
    opened: () => {},
    letGo: () => {},
    click: (() => {}) as (event: globalThis.MouseEvent) => void,
  });

  useEffect(() => {
    latest.current = { settings, reduce };
    hoverApi.current = {
      evaluate: evaluateHover,
      close: closePeeks,
      release: releaseMotion,
      opened: releaseOpened,
      letGo: releaseGently,
      click: onRowClick,
    };
  });

  function register(key: string, element: HTMLElement | null) {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  }

  function applyRest(at: number) {
    const g = geometry.current;

    items.forEach((_, index) => {
      const element = elements.current.get(`m${index}`);
      if (!element) return;

      const slot = slotOf(index, at, n);
      restStyle(
        element,
        slotPose(g, slot),
        slot === 0 ? 1 : 0,
        slot < VISIBLE_SLOTS,
      );
    });
  }

  function cancelTween() {
    zone.current.dirty = true;
    held.current = null;
    const current = tween.current;
    if (tween.current) announceStep("end");
    tween.current = null;
    delete rowRef.current?.dataset.stepping;
    delete rowRef.current?.dataset.mask;
    rowRef.current?.style.removeProperty("--car-fade");
    rowRef.current?.style.removeProperty("--car-rm");
    // A copy that slid out with the step is finished with.
    const copy = elements.current.get("peekL");
    if (copy && !peek.current.els) copy.style.visibility = "hidden";
    current?.animations.forEach((animation) => animation.cancel());
  }

  function peekEls(): PeekEls | null {
    const row = rowRef.current;
    const prev = elements.current.get("peekL");
    if (!row || !prev) return null;

    const g = geometry.current;
    const cards: PeekCard[] = [];

    for (const [slot, item] of movedItems(n, offsetRef.current).entries()) {
      const el = elements.current.get(`m${item}`);
      if (!el) return null;

      cards.push({ item, el, restX: g.slots[slot].x });
    }

    // The edge-blur layers live inside the edge cards, so the row's hold mask
    // fades them with the cards themselves. The card that is leaving the right
    // edge keeps its layer for the step and is faded out by the step itself.
    const blurs = [
      ...row.querySelectorAll<HTMLElement>("[data-peek-blur]"),
    ].filter((layer) => !layer.closest("[data-peek-out]"));

    return { row, prev, cards, blurs };
  }

  function setPeek(open: boolean) {
    const state = peek.current;
    const row = rowRef.current;
    const g = geometry.current;
    if (!row || g.rowWidth === 0 || state.open === open) return;
    zone.current.dirty = true;

    const els = open ? peekEls() : state.els;
    if (!els) return;

    const { settings: s, reduce: reduced } = latest.current;
    const layout = peekLayout(g);

    state.open = open;
    state.els = els;
    state.layout = layout;
    row.dataset.peeking = "";
    state.anims = tweenPeek(
      els,
      layout,
      open,
      {
        reveal: s.revealMs,
        retract: s.retractMs,
        reduce: reduced,
        fade: s.hoverFade,
      },
      state.anims,
      () => {
        if (state.open) return;
        state.anims = [];
        state.els = null;
        state.layout = null;
        delete row.dataset.peeking;
      },
    );
  }

  /** Puts the hover peek away at once (a step, a resize, a click). */
  function closePeeks() {
    const state = peek.current;
    zone.current.dirty = true;
    held.current = null;

    if (state.timer !== null) window.clearTimeout(state.timer);
    if (state.els) closeSnap(state.els, state.anims);
    state.timer = null;
    state.open = false;
    state.frozen = false;
    state.anims = [];
    state.els = null;
    state.layout = null;

    const row = rowRef.current;
    if (row) {
      row.style.removeProperty("--car-fade");
      row.style.removeProperty("--car-rm");
      delete row.dataset.peeking;
      delete row.dataset.mask;
    }
    setPeekOut(null);
    setEdgeLeft(NO_ITEMS);
  }

  /** Whether the pointer, where it is now, asks for the peek. */
  function hoverWant(): boolean {
    const row = rowRef.current;
    const at = pointer.current;
    if (!row || !at || n < VISIBLE_SLOTS) return false;
    if (geometry.current.rowWidth === 0) return false;

    const { settings: s } = latest.current;
    const state = peek.current;
    const cached = zone.current;
    if (cached.dirty || !cached.rect) {
      cached.rect = row.getBoundingClientRect();
      cached.dirty = false;
    }

    // Wider only while open (and not while retracting), so the pointer can
    // reach the previous card; a retract is not undone by a pointer that is
    // outside the rest zone. The band never reaches far into the page gutter.
    return inZone(
      at.x,
      at.y,
      cached.rect,
      state.open ? (state.layout?.shift ?? s.hoverZone) : s.hoverZone,
      s.hoverOutside,
    );
  }

  /**
   * Drives only the copy, the edge fade and the blur on a run the step owns:
   * the same reveal or retract as `setPeek`, but on the step's duration and
   * curve, and never touching the cards.
   */
  function drivePeek(open: boolean, duration: number, easing: string) {
    const state = peek.current;
    const row = rowRef.current;
    const g = geometry.current;
    if (!row || g.rowWidth === 0) return;

    const els = open ? (state.els ?? peekEls()) : state.els;
    if (!els) return;

    const layout = peekLayout(g);
    const { settings: s } = latest.current;

    state.open = open;
    state.els = els;
    state.layout = layout;
    state.timer = null;
    zone.current.dirty = true;
    row.dataset.peeking = "";
    state.anims = tweenPeek(
      els,
      layout,
      open,
      {
        reveal: s.revealMs,
        retract: s.retractMs,
        reduce: false,
        fade: s.hoverFade,
        run: { duration, easing },
        cards: false,
      },
      state.anims,
      () => {
        if (state.open) return;
        state.anims = [];
        state.els = null;
        state.layout = null;
        delete row.dataset.peeking;
      },
    );
  }

  /**
   * Lands a step in the peek arrangement it was aimed at, with no animation of
   * its own: the run's last frame already shows exactly this.
   */
  function landPeeked() {
    const state = peek.current;
    const row = rowRef.current;
    const g = geometry.current;
    if (!row || g.rowWidth === 0) return;

    const els = state.els ?? peekEls();
    if (!els) return;

    const layout = peekLayout(g);
    const { settings: s } = latest.current;

    state.open = true;
    state.els = els;
    state.layout = layout;
    state.timer = null;
    zone.current.dirty = true;
    row.dataset.peeking = "";
    openSnap(els, layout, s.hoverFade);
  }

  /**
   * Re-aims the step that is running at the rest arrangement or at the peek
   * arrangement, from the poses it is drawn at this instant. A pointer that
   * changes its mind mid-glide turns the one run round on the retarget curve
   * instead of waiting to replay a peek after it lands.
   */
  function glideTo(peekAfter: boolean) {
    const running = tween.current;
    const row = rowRef.current;
    if (!running || running.settling || !row) return;
    if (typeof row.animate !== "function") return;

    const at = offsetRef.current;
    const g = geometry.current;
    if (g.rowWidth === 0) return;

    const layout = peekLayout(g);
    const shift = peekAfter ? layout.shift : 0;
    const spec = bezierSpec(RETARGET_BEZIER);
    const easing =
      spec.css.startsWith("linear(") && !supportsLinearEasing()
        ? FALLBACK_EASING
        : spec.css;
    const fadeNow = read(row, "--car-fade");
    const maskNow = read(row, "--car-rm");
    // The right edge's own strength as it is drawn now: a run that turns back
    // to rest carries this on to zero instead of dropping back to full.
    const rightItem = slotOrder(n, at)[VISIBLE_SLOTS - 2];
    const rightEl = elements.current.get(`m${rightItem}`);
    const rfNow = rightEl && !peekAfter ? read(rightEl, "--car-rf") : 0;

    // Start from the poses drawn this instant, read off the cards themselves,
    // not from the clock: the animation's timeline can lag the wall clock by a
    // frame or more under load, and a clock-based start would jump.
    const drawnPoses = new Map<
      string,
      { x: number; w: number; title: number }
    >();
    for (const entity of running.entities) {
      const element = elements.current.get(entityKey(entity));
      if (!element) continue;

      const box = Number.parseFloat(element.style.width);
      const crop = read(element, "--car-r");
      const title = element.querySelector<HTMLElement>("[data-car-title]");

      drawnPoses.set(entityKey(entity), {
        x: read(element, "--car-x"),
        w: Number.isFinite(box) ? Math.max(box - crop, 1) : entity.from.w,
        title: title ? Number.parseFloat(getComputedStyle(title).opacity) : NaN,
      });
    }

    const planned = running.entities.map((entity) => {
      const pose = drawnPoses.get(entityKey(entity));
      const slot = slotOf(entity.item, at, n);
      const dest = slotPose(g, slot);
      const visible = slot < VISIBLE_SLOTS;
      const wide = !entity.ghost && slot === 0;
      // A card that is already on its way out through an end stays on that
      // course: the row's shift moves the ones on screen, it does not send a
      // card back across the row to a slot it was leaving. Only a wrap has a
      // seam copy, so the pair identifies it.
      const leaving =
        !entity.ghost &&
        running.entities.some((other) => other.ghost && other.item === entity.item);
      const to = leaving
        ? entity.to
        : { x: dest.x + (visible ? shift : 0), w: dest.w };

      return {
        ...entity,
        from: pose ? { x: pose.x, w: pose.w } : entity.from,
        fromTitle:
          pose && Number.isFinite(pose.title) ? pose.title : entity.fromTitle,
        to,
        toWide: wide ? 1 : 0,
        toTitle: wide ? 1 : 0,
      };
    });

    const keepPeek = peekAfter || peek.current.open;
    cancelTween();

    const animations: Animation[] = [];
    // Seam copies are played too: a ghost carries its item in from the far end
    // and the real card takes the same pose when the run lands, so hiding it
    // early would leave that slot empty for the rest of the glide.
    for (const entity of planned) {
      const element = elements.current.get(entityKey(entity));
      if (!element) continue;
      if (
        entity.from.x === entity.to.x &&
        entity.from.w === entity.to.w &&
        entity.fromTitle === entity.toTitle
      ) {
        continue;
      }

      animations.push(
        ...playEntity(element, entity, {
          duration: SETTLE_MS,
          easing,
          timing: running.timing,
          blur: { edgeBlur: 0, rowWidth: g.rowWidth },
        }),
      );
    }

    if (keepPeek) {
      // Turning onto the peek keeps the row's own edge mask for the glide and
      // fades it out as the cards' masks take over, so the ends never switch
      // treatment in one frame; turning back to rest leaves it off and lets the
      // cards' masks fade out with `--car-fade`.
      row.dataset.peeking = "";
      row.dataset.mask = "";
      row.style.setProperty("--car-fade", String(fadeNow));
      if (peekAfter) {
        row.dataset.stepping = "";
        row.style.setProperty("--car-rm", String(maskNow));
        animations.push(
          row.animate(
            { "--car-rm": [maskNow, 0] },
            { duration: SETTLE_MS, easing, fill: "both" },
          ),
        );
      }
    }

    // The right edge follows the pointer too: a run turned onto the peek ramps
    // the arriving card's edge in from nothing, one turned back to rest takes it
    // out from where it is drawn.
    if (rightEl && keepPeek) {
      animations.push(
        rightEl.animate(
          { "--car-rf": [rfNow, peekAfter ? 1 : 0] },
          { duration: SETTLE_MS, easing, fill: "both" },
        ),
      );
    }

    if (peekAfter !== peek.current.open || (peekAfter && !peek.current.els)) {
      drivePeek(peekAfter, SETTLE_MS, easing);
    }

    const clock = row.animate({ opacity: [1, 1] }, { duration: SETTLE_MS });
    const started: Tween = {
      entities: planned,
      t0: performance.now(),
      duration: SETTLE_MS,
      ease: spec.fn,
      timing: running.timing,
      animations: [...animations, clock],
      settling: true,
      peek: peekAfter,
    };

    tween.current = started;
    clock.onfinish = () => {
      if (tween.current === started) settle(true);
    };
  }

  /**
   * Opens or retracts the peek from where the pointer is. Nothing runs while a
   * step does; the end of the step calls this again.
   */
  function evaluateHover() {
    const row = rowRef.current;
    if (!row || geometry.current.rowWidth === 0) return;

    const { settings: s } = latest.current;
    const state = peek.current;

    // Held for a reader that is not there: let go (a navigation that is merely
    // slow gets a grace period first).
    if (held.current && Date.now() - held.current.at > HELD_GRACE_MS) {
      if (!overlayPresent()) {
        releaseGently();
        return;
      }
    }
    if (state.frozen) return;

    // A step is in flight: it decides where the row lands, so a pointer that
    // changes its mind mid-glide re-aims that one run instead of starting a
    // peek of its own (see glideTo).
    if (tween.current) {
      const want = hoverWant();
      if (!tween.current.settling && want !== !!tween.current.peek) glideTo(want);
      return;
    }

    const want = hoverWant();

    if (want) {
      if (state.timer !== null) window.clearTimeout(state.timer);
      state.timer = null;
      setPeek(true);
    } else if (state.open && state.timer === null) {
      state.timer = window.setTimeout(() => {
        state.timer = null;
        setPeek(false);
      }, s.leaveMs);
    }
  }

  /** A click on the previous card steps back one from the shifted pose. */
  function onRowClick(event: globalThis.MouseEvent) {
    const row = rowRef.current;
    const target = event.target;
    if (!row || !peek.current.open) return;
    if (!(target instanceof Element) || !target.closest(".car-peek-edge"))
      return;

    // A click while a step is still gliding is another step, not a dropped one:
    // `step` retargets the running plan from the cards' drawn poses, the same
    // path an arrow pressed mid-run takes.
    event.preventDefault();
    step(-1, false);
  }

  /**
   * Ends the running step.
   *
   * A run that reached its end (the clock's own finish) lands at once: the
   * cards are already there. A run that is cut short (a hard back, a reader
   * that never reported) glides to rest on the retarget curve instead of
   * jumping, and further soft releases while it glides are ignored. Reduced
   * motion lands at once, since it never moves anything.
   */
  function settle(instant = false, peekTo?: boolean) {
    const running = tween.current;
    if (!running) return;
    if (running.settling && !instant) return;

    const row = rowRef.current;
    const at = offsetRef.current;
    const g = geometry.current;
    const { reduce: reduced } = latest.current;
    // A run aimed at the peek arrangement lands there, so the peek is already
    // showing when the step ends and nothing replays it.
    const peekAfter = peekTo ?? !!running.peek;
    const shift = peekAfter ? peekLayout(g).shift : 0;

    const land = () => {
      applyRest(at);
      if (peekAfter) landPeeked();
      else if (peek.current.open || peek.current.els) closePeeks();
      setGhosts([]);
      setPeekOut(null);
      setEdgeLeft(NO_ITEMS);
      setDomOffset(at);
      setSettled((count) => count + 1);
    };

    if (
      instant ||
      reduced ||
      !row ||
      typeof row.animate !== "function" ||
      g.rowWidth === 0
    ) {
      cancelTween();
      land();
      return;
    }

    // Read where each card is drawn this instant, not from the clock: a frozen
    // step has cancelled its animations, so the clock alone would be ahead.
    const planned = restEntities(g, n, at).map((entity) => {
      const element = elements.current.get(`m${entity.item}`);
      if (!element) return entity;

      const title = element.querySelector<HTMLElement>("[data-car-title]");
      const opacity = title
        ? Number.parseFloat(getComputedStyle(title).opacity)
        : Number.NaN;
      const slot = slotOf(entity.item, at, n);

      return {
        ...entity,
        to:
          peekAfter && slot < VISIBLE_SLOTS
            ? { x: entity.to.x + shift, w: entity.to.w }
            : entity.to,
        from: {
          x: read(element, "--car-x"),
          w: Number.parseFloat(element.style.width) || entity.to.w,
        },
        fromTitle: Number.isFinite(opacity) ? opacity : entity.toTitle,
      };
    });

    const fadeNow = read(row, "--car-fade");
    cancelTween();
    // The seam copies are stand-ins: the cards they copy glide to rest.
    for (const [key, element] of elements.current) {
      if (key.startsWith("g")) element.style.visibility = "hidden";
    }

    const spec = bezierSpec(RETARGET_BEZIER);
    const easing =
      spec.css.startsWith("linear(") && !supportsLinearEasing()
        ? FALLBACK_EASING
        : spec.css;
    const animations: Animation[] = [];

    for (const entity of planned) {
      const element = elements.current.get(`m${entity.item}`);
      if (!element) continue;
      if (
        entity.from.x === entity.to.x &&
        entity.from.w === entity.to.w &&
        entity.fromTitle === entity.toTitle
      ) {
        continue;
      }

      animations.push(
        ...playEntity(element, entity, {
          duration: SETTLE_MS,
          easing,
          timing: running.timing,
          blur: { edgeBlur: 0, rowWidth: g.rowWidth },
        }),
      );
    }

    const keepPeek = peekAfter || peek.current.open;
    if (keepPeek) {
      // It lands peeking, or the peek is still on while the row glides to rest:
      // keep the peek's own edge treatment and let the copy finish its move on
      // this glide instead of a step mask that would have to be swapped for it.
      row.dataset.peeking = "";
      row.style.setProperty("--car-fade", String(fadeNow));
      if (peekAfter) {
        drivePeek(true, SETTLE_MS, easing);
      } else if (peek.current.els) {
        drivePeek(false, SETTLE_MS, easing);
      }
    } else {
      row.dataset.stepping = "";
    }
    const clock = row.animate(
      { opacity: [1, 1] },
      { duration: SETTLE_MS },
    );
    const started: Tween = {
      entities: planned,
      t0: performance.now(),
      duration: SETTLE_MS,
      ease: spec.fn,
      timing: running.timing,
      animations: [...animations, clock],
      settling: true,
      peek: peekAfter,
    };

    tween.current = started;
    announceStep("start");
    clock.onfinish = () => {
      if (tween.current === started) settle(true);
    };
  }

  function firstCard(at: number): HTMLElement | null {
    return (
      elements.current.get(`m${at}`)?.querySelector<HTMLElement>(".car-host") ??
      null
    );
  }

  function step(k: number, viaKeyboard = false) {
    if (n < 2) return;

    const prev = offsetRef.current;
    const next = advance(prev, k, n);
    if (next === prev) return;

    const { settings: s, reduce: reduced } = latest.current;
    const g = geometry.current;

    focusFirst.current = viaKeyboard;
    offsetRef.current = next;

    if (stepMode(reduced) === "crossfade") {
      cancelTween();
      closePeeks();
      flushSync(() => {
        setOffset(next);
        setDomOffset(next);
        setGhosts([]);
        if (!viaKeyboard) setAnnouncement(`Showing ${items[next].title}`);
      });
      applyRest(next);

      // Only the slots whose item changed fade, and only part of the way, so
      // what stays put stays put.
      const was = slotOrder(n, prev);
      const now = slotOrder(n, next);
      for (let slot = 0; slot < VISIBLE_SLOTS; slot++) {
        if (was[slot] === now[slot]) continue;

        const card = elements.current.get(`m${now[slot]}`);
        if (card && typeof card.animate === "function") {
          card.animate(
            { opacity: [CROSSFADE_FROM, 1] },
            { duration: CROSSFADE_MS, easing: "ease-out" },
          );
        }
      }
      if (viaKeyboard) firstCard(next)?.focus({ preventScroll: true });
      evaluateHover();
      return;
    }

    const running = tween.current;

    // The hover peek is hidden while a step runs. Cards leave it from the
    // pose they are drawn at now, and a step back brings the peeking item in
    // from the strip.
    const hover = peek.current;
    const drawn = hover.els ? cardPoses(hover.els) : null;
    // A card that stepped out of the peek on an earlier run is still losing its
    // left fade; a click mid-glide re-plans it, so its drawn strength is carried
    // on rather than restarted from the pin.
    const drawnFades = new Map<number, number>();
    if (hover.els) {
      for (const card of hover.els.cards) {
        if (!card.el.hasAttribute("data-peek-fade")) continue;
        drawnFades.set(card.item, read(card.el, "--car-lf"));
      }
    }
    const wasOpen = hover.open;
    const prevEl = hover.els?.prev ?? null;
    const prevDrawn =
      prevEl && hover.layout
        ? {
            x: read(prevEl, "--car-x"),
            w: hover.layout.prevW,
            outX: hover.layout.prev.fromX,
          }
        : null;
    const rowNow = rowRef.current;
    const fadeNow = rowNow ? read(rowNow, "--car-fade") : 0;
    const maskNow = rowNow ? read(rowNow, "--car-rm") : 0;
    // The card that holds the right edge now (this arrangement's slot 2) is the
    // one that has to hand it over; while a run is in flight its fade and blur
    // are part-way, so their drawn values carry on from there.
    const outItem = slotOrder(n, prev)[VISIBLE_SLOTS - 2];
    const outDrawn = (() => {
      const el = elements.current.get(`m${outItem}`);
      if (!el) return null;
      const layer = el.querySelector<HTMLElement>("[data-peek-blur]");
      const rf = Number.parseFloat(
        getComputedStyle(el).getPropertyValue("--car-rf"),
      );
      const blur = layer
        ? Number.parseFloat(getComputedStyle(layer).opacity)
        : Number.NaN;
      // A settled peek's right edge is at full strength (and a run in flight is
      // part-way, so its drawn value carries on from there).
      return {
        rf: Number.isFinite(rf) ? rf : 1,
        blur: Number.isFinite(blur) ? blur : 1,
      };
    })();
    // The pointer decides where this step lands. If it is in the hover area the
    // run goes straight to the new arrangement's peek poses, so the peek is
    // part of the glide instead of a second animation after it.
    const peekAfter = hoverWant();
    // An interrupt starts on a card that is already moving, so it takes an
    // ease-out that carries speed instead of the gentle-start default.
    const spec = running
      ? bezierSpec(RETARGET_BEZIER)
      : easeSpec(s.ease, s.custom);
    const ease = spec.fn;
    const easing =
      spec.css.startsWith("linear(") && !supportsLinearEasing()
        ? FALLBACK_EASING
        : spec.css;
    const timing: TitleTiming = {
      start: s.titleStart,
      span: s.titleSpan,
      outEnd: TITLE_OUT_END,
    };
    const now = performance.now();

    // An interrupt plans from the cards as they are drawn this instant, so
    // the new step continues the motion instead of snapping or queueing.
    const current = running
      ? sampleEntities(
          running.entities,
          now - running.t0,
          running.duration,
          running.ease,
          running.timing,
        )
      : restEntities(g, n, prev);
    const withPush = drawn
      ? current.map((e) => {
          const pose = drawn.get(e.item);
          if (pose === undefined || e.ghost) return e;

          // The title it is drawn at, too: a click mid-glide interrupts a
          // running fade, and the clock can be a frame behind the drawing.
          const el = elements.current.get(entityKey(e));
          const title = el?.querySelector<HTMLElement>("[data-car-title]");
          const opacity = title
            ? Number.parseFloat(getComputedStyle(title).opacity)
            : Number.NaN;
          // A card already blurred by the previous run (leaving past an end)
          // keeps its blur and ramps from there.
          const filterNow = el ? getComputedStyle(el).filter : "none";

          return {
            ...e,
            from: pose,
            to: pose,
            fromTitle: Number.isFinite(opacity) ? opacity : e.fromTitle,
            edgeBlurFrom:
              filterNow && filterNow !== "none" ? filterNow : undefined,
          };
        })
      : current;
    let planned = retarget(g, n, prev, k, withPush);

    if (wasOpen && k < 0 && prevDrawn) {
      // Stepping back off the peek: the peeked card is already drawn at the
      // left, so it must not wrap round (the plan would send the card off the
      // right and animate a seam copy in from the left, leaving the real card
      // sitting in the right-hand slot). The card itself takes over the copy's
      // pose in this same frame - the copy hides as the card appears there -
      // and runs to the wide slot with every other card.
      const item = peekOf(n, prev);
      const pose = { x: prevDrawn.x, w: prevDrawn.w };
      planned = planned.flatMap((e) => {
        if (e.item !== item) return [e];
        if (!e.ghost) return [];
        return [
          { ...e, ghost: false, from: pose, peekFrom: { fade: s.hoverFade } },
        ];
      });
    }

    // A card that was already leaving the peek keeps losing its left fade on
    // this run, from the strength it is drawn at (planned entities arrive with
    // the fade of the run they came from, which may be stale).
    const handoff = wasOpen && k < 0 && prevDrawn ? peekOf(n, prev) : -1;
    planned = planned.map((e) => {
      if (e.ghost) return e;
      const fade = drawnFades.get(e.item);
      if (fade !== undefined) return { ...e, peekFrom: { fade } };
      // The card taking the copy's pose keeps the copy's own fade.
      if (e.item === handoff) return e;
      return e.peekFrom ? { ...e, peekFrom: undefined } : e;
    });

    if (peekAfter) {
      // Every card lands where the peek's own shift would have put it, so the
      // step's end frame is the peek state itself (the copy is part of the same
      // run, see drivePeek below).
      const shift = peekLayout(g).shift;
      planned = planned.map((e) =>
        slotOf(e.item, next, n) < VISIBLE_SLOTS
          ? { ...e, to: { x: e.to.x + shift, w: e.to.w } }
          : e,
      );
    }

    // Every card the step pushes out through the left end takes the peek's
    // left edge for the run (a step of two or three pushes out more than one).
    const leaving = planned.filter((e) => e.edgeLeft && !e.ghost);

    closePeeks();

    cancelTween();
    flushSync(() => {
      setOffset(next);
      setGhosts(planned.filter((e) => e.ghost).map((e) => e.item));
      // The right edge of the arrangement the run is leaving keeps the treatment
      // for the length of the run, fading out with it (see the peek block below).
      setPeekOut(peekAfter && wasOpen ? outItem : null);
      setEdgeLeft(leaving.map((e) => e.item));
      if (!viaKeyboard) setAnnouncement(`Showing ${items[next].title}`);
    });

    const row = rowRef.current;
    if (!row || typeof row.animate !== "function") {
      applyRest(next);
      setGhosts([]);
      setDomOffset(next);
      if (viaKeyboard) firstCard(next)?.focus({ preventScroll: true });
      return;
    }

    const animations: Animation[] = [];

    // One loop, one frame, no per-slot delay: every card's run below (and the
    // titles') is created in this task, so the whole row shares one start time
    // and one curve. The wide featured card still covers far more ground than
    // the narrow slots in the same 900ms, so it reads louder early; that is
    // travel, not sequencing.
    for (const entity of planned) {
      const element = elements.current.get(entityKey(entity));
      if (!element) continue;

      animations.push(
        ...playEntity(element, entity, {
          duration: s.duration,
          easing,
          timing,
          blur: {
            edgeBlur: s.edgeBlur,
            rowWidth: g.rowWidth,
          },
        }),
      );
    }

    if (peekAfter) {
      // The peek stays on through the step: its own edge masks stand in for the
      // step's row mask, so nothing has to be swapped when the run lands.
      row.dataset.peeking = "";
      row.dataset.mask = "";
      row.style.setProperty("--car-fade", String(fadeNow));
      drivePeek(true, s.duration, easing);

      // The right edge changes hands on this same run: the arriving card ramps
      // its fade and blur in from nothing, the leaving one ramps its own out
      // from where it is drawn (a click mid-glide hands over a fade that is
      // already part-way), with the blur copy that stood in for it.
      const inItem = slotOrder(n, next)[VISIBLE_SLOTS - 2];
      const inEl = elements.current.get(`m${inItem}`);
      if (inEl) {
        animations.push(
          inEl.animate(
            { "--car-rf": [0, 1] },
            { duration: s.duration, easing, fill: "both" },
          ),
        );
      }

      const outEl =
        wasOpen && outItem !== inItem
          ? elements.current.get(`m${outItem}`)
          : null;
      if (outEl) {
        animations.push(
          outEl.animate(
            { "--car-rf": [outDrawn?.rf ?? 1, 0] },
            { duration: s.duration, easing, fill: "both" },
          ),
        );
        const layer = outEl.querySelector<HTMLElement>("[data-peek-blur]");
        if (layer) {
          animations.push(
            layer.animate(
              { opacity: [outDrawn?.blur ?? 1, 0] },
              { duration: s.duration, easing, fill: "both" },
            ),
          );
        }
      }
    } else {
      row.dataset.stepping = "";

      // Same duration and start as the cards: eases in, holds, eases out. From
      // a peek it carries on from the peek's own strength then (the row's ends
      // were faded by the cards' masks), so it never pops.
      animations.push(
        row.animate(
          EDGE_KEYFRAMES.map((k, index) => ({
            offset: k.offset,
            easing: k.easing,
            "--car-rm":
              index === 0 ? Math.max(maskNow, fadeNow, k.fade) : k.fade,
          })),
          { duration: s.duration, easing: "linear", fill: "both" },
        ),
      );
    }

    // A card the step pushes out through the left end carries the peek's left
    // edge for the run: its own fade (the frame mask, on `--car-le`) and the
    // progressive blur copy, anchored to the column's edge. Their strength is
    // how far the card has crossed that edge (edgeLeftKeys), on the run's own
    // easing, so it is nothing while the card still rests on the edge and the
    // full Peek fade width once it is that far past: the edge never shows a
    // hard cut on the first frames, nor pops at the click.
    const fadeWidth = Math.max(
      8,
      Math.round(
        (Math.round(g.slots[VISIBLE_SLOTS - 1].w) * s.peekFade) / 100,
      ),
    );
    for (const entity of leaving) {
      const el = elements.current.get(`m${entity.item}`);
      if (!el) continue;
      const keys = edgeLeftKeys(entity.from.x, entity.to.x, fadeWidth);
      animations.push(
        el.animate(
          keys.map((k) => ({ offset: k.offset, "--car-le": k.value })),
          { duration: s.duration, easing, fill: "both" },
        ),
      );
      const layer = el.querySelector<HTMLElement>("[data-peek-blur]");
      if (layer) {
        animations.push(
          layer.animate(
            keys.map((k) => ({ offset: k.offset, opacity: k.value })),
            { duration: s.duration, easing, fill: "both" },
          ),
        );
      }
    }

    // Stepping forward with the peek open: the previous card slides back out to
    // the left with the row instead of vanishing. (A step that lands peeking
    // gives the copy to drivePeek, which brings in the new previous card.)
    if (!peekAfter && wasOpen && k > 0 && prevEl && prevDrawn) {
      prevEl.style.visibility = "visible";
      prevEl.style.setProperty("--car-x", `${prevDrawn.x}px`);
      animations.push(
        prevEl.animate(
          { "--car-x": [`${prevDrawn.x}px`, `${prevDrawn.outX}px`] },
          { duration: s.duration, easing, fill: "both" },
        ),
      );
    }

    // One clock ends the step.
    const clock = row.animate({ opacity: [1, 1] }, { duration: s.duration });
    const started: Tween = {
      entities: planned,
      t0: now,
      duration: s.duration,
      ease,
      timing,
      animations: [...animations, clock],
      peek: peekAfter,
    };

    tween.current = started;
    announceStep("start");
    clock.onfinish = () => {
      if (tween.current === started) settle(true);
    };

    if (viaKeyboard) firstCard(next)?.focus({ preventScroll: true });
  }

  const sync = useEffectEvent(() => {
    const row = rowRef.current;
    const guide = guideRef.current;
    if (!row || !guide) return;

    snapRow(row);
    const measured = measureGeometry(row, guide);
    if (!measured) return;

    cancelTween();
    closePeeks();
    setGhosts([]);
    setDomOffset(offsetRef.current);

    geometry.current = measured;
    zone.current.dirty = true;
    row.style.setProperty("--car-wide", `${measured.slots[0].w}px`);
    // The column's width, so a card can find the column's right edge in its own
    // box (`--car-row-w - --car-x`) for the right edge's fade.
    row.style.setProperty("--car-row-w", `${measured.rowWidth}px`);
    row.dataset.ready = "true";
    applyRest(offsetRef.current);
    setSlotWidths((previous) => {
      const next = measured.slots.map((slot) => Math.round(slot.w));
      return previous &&
        previous.length === next.length &&
        previous.every((width, index) => width === next[index])
        ? previous
        : next;
    });
  });

  useLayoutEffect(() => {
    sync();

    const row = rowRef.current;
    if (!row) return;

    const observer = new ResizeObserver(() => sync());
    observer.observe(row);
    // A centred column can move by half a pixel without changing size (an odd
    // viewport width), which the observer does not see.
    const snap = () => snapRow(row);
    window.addEventListener("resize", snap);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", snap);
    };
  }, []);

  // After a step the peek is re-evaluated: if the pointer is still in the zone
  // it comes back, showing the new previous item.
  useLayoutEffect(() => {
    if (settled === 0) return;

    hoverApi.current.evaluate();
  }, [settled]);

  // The DOM only reorders between steps, which can drop focus; put it back on
  // the first card if the step came from the keyboard.
  useLayoutEffect(() => {
    if (!focusFirst.current) return;

    focusFirst.current = false;
    if (!tween.current)
      firstCard(offsetRef.current)?.focus({ preventScroll: true });
  }, [domOffset]);

  // The reader reports when it has landed and when it starts to close; the row
  // goes back to rest then, while the reader covers it.
  useEffect(() => {
    const opened = () => hoverApi.current.opened();
    const closing = () => hoverApi.current.release();

    // A hard back navigation takes the reader away without a closing event. The
    // layer can still be in the DOM for the transition, so the URL decides: back
    // on the home page means the reader is gone.
    const popped = () => {
      window.setTimeout(() => {
        if (!held.current) return;
        if (!window.location.pathname.startsWith("/work/")) {
          hoverApi.current.letGo();
        }
      }, 0);
    };

    window.addEventListener(OVERLAY_OPENED_EVENT, opened);
    window.addEventListener(OVERLAY_CLOSING_EVENT, closing);
    window.addEventListener("popstate", popped);

    return () => {
      window.removeEventListener("popstate", popped);
      window.removeEventListener(OVERLAY_OPENED_EVENT, opened);
      window.removeEventListener(OVERLAY_CLOSING_EVENT, closing);
    };
  }, []);

  // A step still running when the row goes away must tell the page it is over:
  // the ring glow follows START/END and would otherwise schedule frames forever.
  useEffect(
    () => () => {
      if (tween.current) announceStep("end");
    },
    [],
  );

  const hoverOn = hoverCapable && n >= VISIBLE_SLOTS;

  useEffect(() => {
    if (!hoverOn) return;

    const row = rowRef.current;
    const move = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      hoverApi.current.evaluate();
    };
    const leave = () => {
      pointer.current = null;
      hoverApi.current.evaluate();
    };
    const click = (event: globalThis.MouseEvent) =>
      hoverApi.current.click(event);

    const stale = () => {
      zone.current.dirty = true;
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", stale, { passive: true, capture: true });
    window.addEventListener("resize", stale);
    document.documentElement.addEventListener("mouseleave", leave);
    row?.addEventListener("click", click);

    // The row's own box can move or change size without a window resize (a font
    // swap, the column reflowing), so watch the row as well.
    const observer = new ResizeObserver(stale);
    if (row) observer.observe(row);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", stale, true);
      window.removeEventListener("resize", stale);
      document.documentElement.removeEventListener("mouseleave", leave);
      row?.removeEventListener("click", click);
      hoverApi.current.close();
    };
  }, [hoverOn]);

  /** Stops an animation where it is: its drawn values stay, nothing jumps. */
  function freezeAnimation(animation: Animation) {
    try {
      animation.commitStyles?.();
    } catch {
      // An element that is not rendered has nothing to commit.
    }
    animation.cancel();
  }

  /**
   * The reader is about to measure the featured card, so whatever motion is
   * running (a peek, a reveal or retract, a step) is held exactly where it is
   * drawn: animations are cancelled with their current values written down. The
   * morph then starts from the card's real box and nothing moves. The row goes
   * back to rest only once the reader covers it (releaseMotion).
   */
  function freezeMotion() {
    const hover = peek.current;

    if (hover.timer !== null) window.clearTimeout(hover.timer);
    hover.timer = null;

    const row = rowRef.current;
    const poses = [...elements.current.values()].map((el) => ({
      el,
      x: read(el, "--car-x"),
      r: read(el, "--car-r"),
    }));
    const fade = row ? read(row, "--car-fade") : 0;
    const mask = row ? read(row, "--car-rm") : 0;
    const running = [...hover.anims, ...(tween.current?.animations ?? [])];

    if (running.length === 0 && !hover.els) return;

    running.forEach(freezeAnimation);
    for (const { el, x, r } of poses) {
      el.style.setProperty("--car-x", `${x}px`);
      el.style.setProperty("--car-r", `${r}px`);
    }
    row?.style.setProperty("--car-fade", String(fade));
    row?.style.setProperty("--car-rm", String(mask));

    hover.anims = [];
    if (hover.els) {
      hover.open = false;
      hover.frozen = true;
    }
    held.current = { at: Date.now() };
  }

  /**
   * Lets go of held motion with the row in view: a peek retracts on its own
   * curve from where it is drawn (no snap); a held step is settled.
   */
  function releaseGently() {
    held.current = null;

    const state = peek.current;
    if (state.frozen && state.els) {
      state.frozen = false;
      state.open = true;
      setPeek(false);
    }
    if (tween.current) settle(false, false);
  }

  /** The reader has landed. Whoever held motion can let go. */
  function releaseOpened() {
    // Under the reader this is unseen, so it can land at once. If the reader is
    // not there (its opened event can arrive after a hard back took it away),
    // the row is in view and glides to rest instead.
    if (tween.current) settle(overlayPresent(), false);
    closePeeks();
  }

  /** Back to rest, unseen: the reader is about to close and will measure. */
  function releaseMotion() {
    // Instant: the close morph measures the card right after this, so it has to
    // already be at its rest box.
    if (tween.current) settle(true, false);
    closePeeks();
  }

  function onActivate(event: MouseEvent<HTMLElement>, index: number) {
    const slot = slotOf(index, offsetRef.current, n);
    const action = clickAction(slot, items[index].kind);

    if (action.type === "open") {
      // The morph measures the card where it is drawn, so hold it there.
      if (!isModified(event)) freezeMotion();
      return;
    }

    if (isModified(event)) return;

    event.preventDefault();
    if (action.type === "step") step(action.by, event.detail === 0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;

    const by = keyStep(event.key);
    if (by === 0) return;

    event.preventDefault();
    step(by, true);
  }

  const domOrder = slotOrder(n, domOffset);
  // The card that held the peek's right edge when the running step started
  // keeps the treatment for the run and hands it over (set per step).
  const peekOutItem = peekOut ?? -1;
  // The featured card the running step pushes out through the left end.
  const peekFadeWidth = (cardWidth: number) =>
    Math.max(8, Math.round((cardWidth * settings.peekFade) / 100));
  // The peek's outer fade widths are a share of those two cards, so they need
  // the measured slot widths; the blur radius and ramp are plain settings.
  const rowStyle = {
    "--car-edge-w": `${settings.edgeWidth}px`,
    "--car-peek-blur": `${settings.peekBlurMax}px`,
    "--car-peek-ramp": `${settings.peekBlurRamp}`,
    ...(slotWidths
      ? {
          "--peek-fade-left": `${peekFadeWidth(slotWidths[VISIBLE_SLOTS - 1])}px`,
          "--peek-fade-right": `${peekFadeWidth(slotWidths[VISIBLE_SLOTS - 2])}px`,
        }
      : {}),
  } as CSSProperties;

  return (
    <>
      <section
        aria-roledescription="carousel"
        aria-label="Selected work"
        onKeyDown={onKeyDown}
        className="relative hidden md:block"
      >
        <div ref={rowRef} className="car-row" style={rowStyle}>
          <div ref={guideRef} aria-hidden="true" className="car-guide">
            <div />
            <div />
            <div />
            <div />
          </div>

          {domOrder.map((index) => {
            const slot = slotOf(index, offset, n);

            return (
              <Slide
                key={`m${index}`}
                item={items[index]}
                index={index}
                slot={slot}
                total={n}
                ghost={false}
                peekOut={index === peekOutItem && slot !== VISIBLE_SLOTS - 2}
                edgeLeft={edgeLeft.includes(index)}
                // Only the right-most slot and beyond can cross the right edge:
                // where the card is going (`offset`) or where the last run left
                // it (`domOffset`), so a run in flight keeps its layer.
                crossRight={
                  slot >= VISIBLE_SLOTS - 1 ||
                  slotOf(index, domOffset, n) >= VISIBLE_SLOTS - 1
                }
                register={register}
                onActivate={onActivate}
              />
            );
          })}

          {hoverCapable && n >= VISIBLE_SLOTS ? (
            <Slide
              item={items[peekOf(n, offset)]}
              index={peekOf(n, offset)}
              slot={VISIBLE_SLOTS}
              total={n}
              ghost
              peek
              register={register}
              onActivate={onActivate}
            />
          ) : null}

          {ghosts.map((index) => (
            <Slide
              key={`g${index}`}
              item={items[index]}
              index={index}
              slot={slotOf(index, offset, n)}
              total={n}
              ghost
              crossRight
              register={register}
              onActivate={onActivate}
            />
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </section>

      {tune ? (
        <CarouselTuner
          settings={settings}
          onChange={(patch) =>
            setSettings((previous) => ({ ...previous, ...patch }))
          }
        />
      ) : null}
    </>
  );
}
