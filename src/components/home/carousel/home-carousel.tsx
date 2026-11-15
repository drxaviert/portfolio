"use client";

import { useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { WORK_SLIVERS } from "../home-cards";
import { RingLayers } from "../ring-hover";
import { EDGE_KEYFRAMES, motionBlurAt, parseBlurMode } from "./blur-mode";
import type { BlurMode } from "./blur-mode";
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
  blurNow,
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
import { parseSliverMode, useLocationSearch } from "./sliver-mode";
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
  blurMode: BlurMode;
  motionPeak: number;
  animations: Animation[];
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
const TITLE_OUT_END = 0.12;

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

type SlideProps = {
  item: CarouselItem;
  index: number;
  slot: number;
  total: number;
  ghost: boolean;
  /** The hover peek's strip: the previous item, as a plain inert copy. */
  peek?: boolean;
  fillSlot: number;
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
  fillSlot,
  register,
  onActivate,
}: SlideProps) {
  const first = slot === 0 && !ghost;
  const offscreen = slot >= VISIBLE_SLOTS;
  const key = peek ? "peekL" : `${ghost ? "g" : "m"}${index}`;
  const fill = WORK_SLIVERS[(fillSlot - 1) % WORK_SLIVERS.length].fill;
  const hostClass = "car-host ring-host rounded-lg";

  const body = (
    <>
      <RingLayers fill="bg-surface-container-low" />
      <div className="car-clip rounded-lg">
        <div className="car-content">
          <span
            aria-hidden="true"
            data-car-grey=""
            className={`car-grey absolute inset-0 ${fill}`}
          />
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
  const mode = parseSliverMode(search);
  const blurMode = parseBlurMode(search);
  const hoverCapable = useHoverCapable();
  const tune = new URLSearchParams(search).get("tune") === "1";

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // `offset` is the target: labels, slots and the announcement follow it at
  // once. `domOffset` is the order the DOM is in, which only changes between
  // steps so a moving card is never re-parented mid-tween.
  const [offset, setOffset] = useState(0);
  const [domOffset, setDomOffset] = useState(0);
  const [ghosts, setGhosts] = useState<number[]>([]);
  const [fills, setFills] = useState<number[]>(() =>
    items.map((_, index) => (index === 0 ? 1 : Math.min(index, 3))),
  );
  const [announcement, setAnnouncement] = useState("");
  const [settled, setSettled] = useState(0);

  const rowRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const geometry = useRef<Geometry>(EMPTY_GEOMETRY);
  const offsetRef = useRef(0);
  const tween = useRef<Tween | null>(null);
  const focusFirst = useRef(false);
  const latest = useRef({ settings, mode, blurMode, reduce });
  const peek = useRef<PeekState>(idlePeek());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const hoverApi = useRef({
    evaluate: () => {},
    close: () => {},
    release: () => {},
    click: (() => {}) as (event: globalThis.MouseEvent) => void,
  });

  useEffect(() => {
    latest.current = { settings, mode, blurMode, reduce };
    hoverApi.current = {
      evaluate: evaluateHover,
      close: closePeeks,
      release: releaseMotion,
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
        latest.current.mode,
      );
    });
  }

  function cancelTween() {
    const current = tween.current;
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

    return { row, prev, cards };
  }

  function setPeek(open: boolean) {
    const state = peek.current;
    const row = rowRef.current;
    const g = geometry.current;
    if (!row || g.rowWidth === 0 || state.open === open) return;

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
    if (state.frozen) return;
    const rect = row.getBoundingClientRect();
    const at = pointer.current;
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

  /** Ends the running step now: every card at rest, the seam copy dropped. */
  function settle() {
    if (!tween.current) return;

    cancelTween();
    applyRest(offsetRef.current);
    setGhosts([]);
    setDomOffset(offsetRef.current);
    setSettled((count) => count + 1);
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

    const {
      settings: s,
      mode: m,
      blurMode: bm,
      reduce: reduced,
    } = latest.current;
    const g = geometry.current;
    const nextFills = (previous: number[]) =>
      previous.map((fill, index) => {
        const slot = slotOf(index, next, n);
        return slot > 0 ? Math.min(slot, 3) : fill;
      });

    focusFirst.current = viaKeyboard;
    offsetRef.current = next;

    if (stepMode(reduced) === "crossfade") {
      cancelTween();
      closePeeks();
      flushSync(() => {
        setOffset(next);
        setDomOffset(next);
        setGhosts([]);
        setFills(nextFills);
        setAnnouncement(`Showing ${items[next].title}`);
      });
      applyRest(next);

      const row = rowRef.current;
      if (row && typeof row.animate === "function") {
        row.animate(
          { opacity: [0.2, 1] },
          { duration: CROSSFADE_MS, easing: "ease-out" },
        );
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
            blur: blurNow(prevEl),
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
              peekFrom: { blur: prevDrawn.blur, fade: s.hoverFade },
            }
          : e,
      );
    }

    closePeeks();

    cancelTween();
    flushSync(() => {
      setOffset(next);
      setGhosts(planned.filter((e) => e.ghost).map((e) => e.item));
      setFills(nextFills);
      setAnnouncement(`Showing ${items[next].title}`);
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
    const elapsed = running ? now - running.t0 : 0;
    const progress = running
      ? running.ease(Math.min(Math.max(elapsed / running.duration, 0), 1))
      : 0;
    const motionFrom =
      running && running.blurMode === "motion"
        ? motionBlurAt(running.motionPeak, progress)
        : 0;

    for (const entity of planned) {
      const element = elements.current.get(entityKey(entity));
      if (!element) continue;

      animations.push(
        ...playEntity(element, entity, {
          duration: s.duration,
          easing,
          mode: m,
          timing,
          blur: {
            mode: bm,
            motionPeak: s.motionPeak,
            motionFrom,
            edgeBlur: s.edgeBlur,
            rowWidth: g.rowWidth,
          },
        }),
      );
    }

    row.dataset.stepping = "";

    if (bm === "edge") {
      // Same duration and start as the cards: eases in, holds, eases out. From
      // a peek it carries on from the mask's strength then, so it never pops.
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
    } else if (fadeNow > 0.01) {
      // The peek's mask eases out instead of vanishing when the step starts.
      row.dataset.mask = "";
      const out = row.animate(
        { "--car-fade": [fadeNow, 0] },
        { duration: 220, easing: "ease-out" },
      );
      out.onfinish = () => {
        if (tween.current === started) delete row.dataset.mask;
      };
      animations.push(out);
    }

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
      blurMode: bm,
      motionPeak: s.motionPeak,
      animations: [...animations, clock],
    };

    tween.current = started;
    clock.onfinish = () => {
      if (tween.current === started) settle();
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
    row.style.setProperty("--car-wide", `${measured.slots[0].w}px`);
    row.dataset.ready = "true";
    applyRest(offsetRef.current);
  });

  useLayoutEffect(() => {
    sync();

    const row = rowRef.current;
    if (!row) return;

    const observer = new ResizeObserver(() => sync());
    observer.observe(row);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    sync();
  }, [mode, blurMode]);

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
    const release = () => hoverApi.current.release();

    window.addEventListener(OVERLAY_OPENED_EVENT, release);
    window.addEventListener(OVERLAY_CLOSING_EVENT, release);

    return () => {
      window.removeEventListener(OVERLAY_OPENED_EVENT, release);
      window.removeEventListener(OVERLAY_CLOSING_EVENT, release);
    };
  }, []);

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

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    row?.addEventListener("click", click);

    return () => {
      window.removeEventListener("pointermove", move);
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
  }

  /** Back to rest, unseen: the reader has landed, or is about to close. */
  function releaseMotion() {
    if (tween.current) settle();
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
    "--car-hp-blur": `${settings.hoverBlur}px`,
    "--car-hp-blur-on": `${settings.hoverBlurOn}px`,
  } as CSSProperties;

  return (
    <>
      <section
        aria-roledescription="carousel"
        aria-label="Selected work"
        onKeyDown={onKeyDown}
        className="hidden md:block"
      >
        <div
          ref={rowRef}
          className="car-row"
          data-blur={blurMode}
          style={rowStyle}
        >
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
              fillSlot={fills[index]}
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
              fillSlot={fills[peekOf(n, domOffset)]}
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
              fillSlot={fills[index]}
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
          blurMode={blurMode}
          onChange={(patch) =>
            setSettings((previous) => ({ ...previous, ...patch }))
          }
        />
      ) : null}
    </>
  );
}
