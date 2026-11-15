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

/** The peek's edge blur layer, drawn above the row so it can smear outward. */
function PeekEdgeBlur({
  edge,
  item,
  cardWidth,
  ramp,
  wide,
  blur,
}: {
  edge: "left" | "right";
  item: CarouselItem;
  cardWidth: number;
  ramp: number;
  wide: number;
  blur: number;
}) {
  // A placeholder has no picture: nothing to smear.
  if (item.kind !== "work") return null;

  return (
    <span
      aria-hidden="true"
      data-peek-blur=""
      data-edge={edge}
      className="car-peek-blur"
      style={
        {
          "--peek-card-w": `${cardWidth}px`,
          "--peek-ramp": `${ramp}px`,
          "--peek-blur": `${blur}px`,
          "--car-wide": `${wide}px`,
        } as CSSProperties
      }
    >
      <span className="car-peek-blur-copy">
        <span className="car-content">
          <span className="absolute inset-0 overflow-hidden">
            <Cover scene={item.cover} fit="cover" />
          </span>
          <span className="card-fade pointer-events-none absolute inset-8 z-[1] rounded-[8px]" />
        </span>
      </span>
    </span>
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
  register,
  onActivate,
}: SlideProps) {
  const first = slot === 0 && !ghost;
  const offscreen = slot >= VISIBLE_SLOTS;
  const key = peek ? "peekL" : `${ghost ? "g" : "m"}${index}`;
  const hostClass = "car-host ring-host rounded-lg";

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
      className={peek ? "car-slide car-peek car-peek-edge" : "car-slide"}
    >
      {host}
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

    // The edge-blur layers are the row's siblings (above its mask), not its
    // children: they have to paint past the column's edge.
    const blurs = [
      ...(row.parentElement?.querySelectorAll<HTMLElement>("[data-peek-blur]") ??
        []),
    ];

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
        row.style.removeProperty("--car-fade");
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
      delete row.dataset.peeking;
      delete row.dataset.mask;
    }
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
    const at = pointer.current;

    // Far from the zone with nothing to retract: nothing to do, and no layout
    // read at all while the cached box is good.
    const cached = zone.current;
    if (cached.dirty || !cached.rect) {
      cached.rect = row.getBoundingClientRect();
      cached.dirty = false;
    }
    const rect = cached.rect;
    const want =
      !!at &&
      n >= VISIBLE_SLOTS &&
      !tween.current &&
      inZone(
        at.x,
        at.y,
        rect,
        // Wider only while open (and not while retracting), so the pointer can
        // reach the previous card; a retract is not undone by a pointer that
        // is outside the rest zone.
        state.open ? (state.layout?.shift ?? s.hoverZone) : s.hoverZone,
      );

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
    if (!row || tween.current || !peek.current.open) return;
    if (!(target instanceof Element) || !target.closest(".car-peek-edge"))
      return;

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
  function settle(instant = false) {
    const running = tween.current;
    if (!running) return;
    if (running.settling && !instant) return;

    const row = rowRef.current;
    const at = offsetRef.current;
    const g = geometry.current;
    const { reduce: reduced } = latest.current;

    const land = () => {
      applyRest(at);
      setGhosts([]);
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

      return {
        ...entity,
        from: {
          x: read(element, "--car-x"),
          w: Number.parseFloat(element.style.width) || entity.to.w,
        },
        fromTitle: Number.isFinite(opacity) ? opacity : entity.toTitle,
      };
    });

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

    row.dataset.stepping = "";
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
          return pose === undefined || e.ghost
            ? e
            : { ...e, from: pose, to: pose };
        })
      : current;
    let planned = retarget(g, n, prev, k, withPush);

    if (wasOpen && k < 0 && prevDrawn) {
      const item = peekOf(n, prev);
      planned = planned.map((e) =>
        e.item === item && e.to.x < g.rowWidth && e.to.x + e.to.w > 0
          ? {
              ...e,
              from: { x: prevDrawn.x, w: prevDrawn.w },
              peekFrom: { fade: s.hoverFade },
            }
          : e,
      );
    }

    closePeeks();

    cancelTween();
    flushSync(() => {
      setOffset(next);
      setGhosts(planned.filter((e) => e.ghost).map((e) => e.item));
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

    row.dataset.stepping = "";

    // Same duration and start as the cards: eases in, holds, eases out. From a
    // peek it carries on from the mask's strength then, so it never pops.
    animations.push(
      row.animate(
        EDGE_KEYFRAMES.map((k, index) => ({
          offset: k.offset,
          easing: k.easing,
          "--car-fade": index === 0 ? Math.max(fadeNow, k.fade) : k.fade,
        })),
        { duration: s.duration, easing: "linear", fill: "both" },
      ),
    );

    // Stepping forward with the peek open: the previous card slides back out to
    // the left with the row instead of vanishing.
    if (wasOpen && k > 0 && prevEl && prevDrawn) {
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

    const measured = measureGeometry(row, guide);
    if (!measured) return;

    cancelTween();
    closePeeks();
    setGhosts([]);
    setDomOffset(offsetRef.current);

    geometry.current = measured;
    zone.current.dirty = true;
    row.style.setProperty("--car-wide", `${measured.slots[0].w}px`);
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

    return () => observer.disconnect();
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
    const running = [...hover.anims, ...(tween.current?.animations ?? [])];

    if (running.length === 0 && !hover.els) return;

    running.forEach(freezeAnimation);
    for (const { el, x, r } of poses) {
      el.style.setProperty("--car-x", `${x}px`);
      el.style.setProperty("--car-r", `${r}px`);
    }
    row?.style.setProperty("--car-fade", String(fade));

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
    if (tween.current) settle();
  }

  /** The reader has landed. Whoever held motion can let go. */
  function releaseOpened() {
    // Under the reader this is unseen, so it can land at once. If the reader is
    // not there (its opened event can arrive after a hard back took it away),
    // the row is in view and glides to rest instead.
    if (tween.current) settle(overlayPresent());
    closePeeks();
  }

  /** Back to rest, unseen: the reader is about to close and will measure. */
  function releaseMotion() {
    // Instant: the close morph measures the card right after this, so it has to
    // already be at its rest box.
    if (tween.current) settle(true);
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
  const rowStyle = {
    "--car-edge-w": `${settings.edgeWidth}px`,
  } as CSSProperties;
  const peekRamp = (cardWidth: number) =>
    Math.max(1, Math.round((cardWidth * settings.peekBlurRamp) / 100));

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

          {domOrder.map((index) => (
            <Slide
              key={`m${index}`}
              item={items[index]}
              index={index}
              slot={slotOf(index, offset, n)}
              total={n}
              ghost={false}
              register={register}
              onActivate={onActivate}
            />
          ))}

          {hoverCapable && n >= VISIBLE_SLOTS ? (
            <Slide
              item={items[peekOf(n, domOffset)]}
              index={peekOf(n, domOffset)}
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
              register={register}
              onActivate={onActivate}
            />
          ))}
        </div>

        {hoverCapable && n >= VISIBLE_SLOTS && slotWidths ? (
          <>
            <PeekEdgeBlur
              edge="left"
              item={items[peekOf(n, offset)]}
              cardWidth={slotWidths[VISIBLE_SLOTS - 1]}
              ramp={peekRamp(slotWidths[VISIBLE_SLOTS - 1])}
              wide={slotWidths[0]}
              blur={settings.peekBlurMax}
            />
            <PeekEdgeBlur
              edge="right"
              item={items[slotOrder(n, offset)[VISIBLE_SLOTS - 2]]}
              cardWidth={slotWidths[VISIBLE_SLOTS - 2]}
              ramp={peekRamp(slotWidths[VISIBLE_SLOTS - 2])}
              wide={slotWidths[0]}
              blur={settings.peekBlurMax}
            />
          </>
        ) : null}

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
