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
import {
  EDGE_KEYFRAMES,
  PEEK_GAP,
  blur,
  motionBlurAt,
  parseBlurMode,
} from "./blur-mode";
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
  offRight,
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
import { closeSnap, pushedPose, tweenPeek } from "./hover-peek-dom";
import type { PeekEls } from "./hover-peek-dom";
import {
  inZone,
  onStrip,
  peekItem as peekOf,
  peekLayout,
  pushedItem,
  resolveRightEdge,
  useHoverCapable,
} from "./hover-peek";
import type { PeekLayout, PeekSide } from "./hover-peek";
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
};

const SIDES: PeekSide[] = ["left", "right"];

function idlePeek(): PeekState {
  return { open: false, anims: [], timer: null, els: null, layout: null };
}

const FALLBACK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const CROSSFADE_MS = 120;
const STRIP_FADE_MS = 120;
const STRIP_RETURN_MS = 240;
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
  rightGap: number | undefined,
): Geometry | null {
  const rowRect = row.getBoundingClientRect();
  if (rowRect.width === 0) return null;

  const slots = Array.from(guide.children)
    .slice(0, VISIBLE_SLOTS)
    .map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.left - rowRect.left, w: rect.width };
    });

  return { slots, rowWidth: rowRect.width, gap: GAP, rightGap };
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
  /** The static strip of the next card at the right edge (blur=peek). */
  peek?: boolean | PeekSide;
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
  const key =
    peek === true
      ? "peek"
      : peek
        ? peek === "left"
          ? "peekL"
          : "peekR"
        : `${ghost ? "g" : "m"}${index}`;
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
      inert={ghost || offscreen}
      data-slot={slot}
      data-ghost={ghost ? "" : undefined}
      data-offscreen={offscreen ? "" : undefined}
      data-side={typeof peek === "string" ? peek : undefined}
      className={
        peek === true
          ? "car-slide car-peek"
          : peek
            ? "car-slide car-peek car-peek-edge"
            : "car-slide"
      }
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
  const { right: rightEdge, blur: blurMode } = resolveRightEdge(
    search,
    parseBlurMode(search),
  );
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
  const stripFade = useRef<Animation | null>(null);
  const latest = useRef({ settings, mode, blurMode, reduce, rightEdge });
  const peeks = useRef<Record<PeekSide, PeekState>>({
    left: idlePeek(),
    right: idlePeek(),
  });
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const hoverApi = useRef({
    evaluate: () => {},
    close: () => {},
    click: (() => {}) as (event: globalThis.MouseEvent) => void,
  });

  useEffect(() => {
    latest.current = { settings, mode, blurMode, reduce, rightEdge };
    hoverApi.current = {
      evaluate: evaluateHover,
      close: closePeeks,
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

    const strip = elements.current.get("peek");
    if (strip) {
      restStyle(strip, offRight(g), 0, true, latest.current.mode);
      strip.style.filter = blur(latest.current.settings.peekBlur);
    }
  }

  function cancelTween() {
    const current = tween.current;
    tween.current = null;
    delete rowRef.current?.dataset.stepping;
    current?.animations.forEach((animation) => animation.cancel());
  }

  function peekEls(side: PeekSide): PeekEls | null {
    const card = elements.current.get(
      `m${pushedItem(side, n, offsetRef.current)}`,
    );
    const strip = elements.current.get(side === "left" ? "peekL" : "peekR");

    return card && strip ? { card, strip } : null;
  }

  function setPeek(side: PeekSide, open: boolean) {
    const state = peeks.current[side];
    const row = rowRef.current;
    const g = geometry.current;
    if (!row || g.rowWidth === 0 || state.open === open) return;

    const els = open ? peekEls(side) : state.els;
    if (!els) return;

    const { settings: s, reduce: reduced } = latest.current;
    const layout = peekLayout(side, g, s.hoverPeek, s.hoverGap);

    state.open = open;
    state.els = els;
    state.layout = layout;
    row.dataset.peeking = "";
    state.anims = tweenPeek(
      els,
      layout,
      open,
      { reveal: s.revealMs, retract: s.retractMs, reduce: reduced },
      state.anims,
      () => {
        if (state.open) return;
        state.anims = [];
        state.els = null;
        state.layout = null;
        if (!SIDES.some((other) => peeks.current[other].els))
          delete row.dataset.peeking;
      },
    );
  }

  /** Puts every hover peek away at once (a step, a resize, a click). */
  function closePeeks() {
    for (const state of Object.values(peeks.current)) {
      if (state.timer !== null) window.clearTimeout(state.timer);
      if (state.els && state.layout)
        closeSnap(state.els, state.layout, state.anims);
      state.timer = null;
      state.open = false;
      state.anims = [];
      state.els = null;
      state.layout = null;
    }

    const row = rowRef.current;
    if (row) {
      delete row.dataset.peeking;
      delete row.dataset.peekHot;
    }
  }

  /**
   * Opens or retracts each peek from where the pointer is. Nothing runs while
   * a step does; the end of the step calls this again.
   */
  function evaluateHover() {
    const row = rowRef.current;
    if (!row || geometry.current.rowWidth === 0) return;

    const { settings: s, rightEdge: right } = latest.current;
    const enabled: Record<PeekSide, boolean> = {
      left: n >= 2,
      right: n >= 2 && right === "hover",
    };
    const rect = row.getBoundingClientRect();
    const at = pointer.current;
    let hot: PeekSide | null = null;

    for (const side of SIDES) {
      const state = peeks.current[side];
      const want =
        !!at &&
        enabled[side] &&
        !tween.current &&
        inZone(side, at.x, at.y, rect, s.hoverZone);

      if (want) {
        if (state.timer !== null) window.clearTimeout(state.timer);
        state.timer = null;
        setPeek(side, true);
      } else if (state.open && state.timer === null) {
        state.timer = window.setTimeout(() => {
          state.timer = null;
          setPeek(side, false);
        }, s.leaveMs);
      }

      if (at && state.open && onStrip(side, at.x, at.y, rect, s.hoverPeek))
        hot = side;
    }

    if (hot) row.dataset.peekHot = hot;
    else delete row.dataset.peekHot;
  }

  /** The strip is inert, so the row takes the click and finds the strip. */
  function onRowClick(event: globalThis.MouseEvent) {
    const row = rowRef.current;
    if (!row || event.target !== row || tween.current) return;

    const rect = row.getBoundingClientRect();
    const size = latest.current.settings.hoverPeek;

    for (const side of SIDES) {
      if (
        peeks.current[side].open &&
        onStrip(side, event.clientX, event.clientY, rect, size)
      ) {
        event.preventDefault();
        step(side === "left" ? -1 : 1, false);
        return;
      }
    }
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

    // A hover peek is hidden while a step runs. Cards leave it from the pose
    // they are drawn at now, and a step toward the peek brings that item in
    // from the strip.
    const pushes = SIDES.flatMap((side) => {
      const state = peeks.current[side];
      if (!state.els || !state.layout) return [];

      return [
        {
          side,
          open: state.open,
          layout: state.layout,
          item: pushedItem(side, n, prev),
          pose: pushedPose(state.els.card, state.layout),
        },
      ];
    });
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
    const withPush = current.map((e) => {
      const push = pushes.find((p) => p.item === e.item && !e.ghost);
      return push ? { ...e, from: push.pose, to: push.pose } : e;
    });
    let planned = retarget(g, n, prev, k, withPush);

    for (const push of pushes) {
      if (!push.open || (push.side === "left") !== k < 0) continue;

      const item = peekOf(push.side, n, prev);
      const size = latest.current.settings.hoverPeek;
      planned = planned.map((e) =>
        e.item === item && e.to.x < g.rowWidth && e.to.x + e.to.w > 0
          ? {
              ...e,
              from: { x: push.layout.strip.toX, w: size },
              blurFrom: latest.current.settings.hoverBlur,
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
            peekBlur: s.peekBlur,
            edgeBlur: s.edgeBlur,
            rowWidth: g.rowWidth,
          },
        }),
      );
    }

    row.dataset.stepping = "";

    if (bm === "edge") {
      // Same duration and start as the cards, linear in time: in fast, hold,
      // out before the end.
      animations.push(
        row.animate(
          EDGE_KEYFRAMES.map((k) => ({
            offset: k.offset,
            "--car-fade": k.fade,
          })),
          { duration: s.duration, easing: "linear", fill: "both" },
        ),
      );
    }

    if (bm === "peek") {
      const strip = elements.current.get("peek");
      if (strip) {
        const shown = Number.parseFloat(getComputedStyle(strip).opacity) || 0;
        stripFade.current?.cancel();
        stripFade.current = strip.animate(
          { opacity: [shown, 0] },
          { duration: STRIP_FADE_MS, easing: "ease-out", fill: "forwards" },
        );
      }
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

    const measured = measureGeometry(
      row,
      guide,
      latest.current.blurMode === "peek" ? PEEK_GAP : undefined,
    );
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
  }, [mode, blurMode, settings.peekBlur]);

  // After a step the strip shows the new next card and fades back in.
  useLayoutEffect(() => {
    if (settled === 0) return;

    hoverApi.current.evaluate();

    const strip = elements.current.get("peek");
    if (!strip || typeof strip.animate !== "function") return;

    stripFade.current?.cancel();
    stripFade.current = strip.animate(
      { opacity: [0, 1] },
      { duration: STRIP_RETURN_MS, easing: "ease-out" },
    );
  }, [settled]);

  // The DOM only reorders between steps, which can drop focus; put it back on
  // the first card if the step came from the keyboard.
  useLayoutEffect(() => {
    if (!focusFirst.current) return;

    focusFirst.current = false;
    if (!tween.current)
      firstCard(offsetRef.current)?.focus({ preventScroll: true });
  }, [domOffset]);

  const hoverOn = hoverCapable && n >= 2;

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

  function onActivate(event: MouseEvent<HTMLElement>, index: number) {
    const slot = slotOf(index, offsetRef.current, n);
    const action = clickAction(slot, items[index].kind);

    if (action.type === "open") {
      // The morph measures the card at rest, so a pushed card goes back first.
      closePeeks();
      // Finish a running step first so the morph measures the card at rest.
      if (!isModified(event)) settle();
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
  const peekItem = domOrder[VISIBLE_SLOTS % n];
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

          {blurMode === "peek" && n >= 2 ? (
            <Slide
              item={items[peekItem]}
              index={peekItem}
              slot={VISIBLE_SLOTS}
              total={n}
              ghost
              peek
              fillSlot={fills[peekItem]}
              register={register}
              onActivate={onActivate}
            />
          ) : null}

          {hoverCapable && n >= 2 ? (
            <Slide
              item={items[peekOf("left", n, domOffset)]}
              index={peekOf("left", n, domOffset)}
              slot={VISIBLE_SLOTS}
              total={n}
              ghost
              peek="left"
              fillSlot={fills[peekOf("left", n, domOffset)]}
              register={register}
              onActivate={onActivate}
            />
          ) : null}

          {hoverCapable && rightEdge === "hover" && n >= 2 ? (
            <Slide
              item={items[peekOf("right", n, domOffset)]}
              index={peekOf("right", n, domOffset)}
              slot={VISIBLE_SLOTS}
              total={n}
              ghost
              peek="right"
              fillSlot={fills[peekOf("right", n, domOffset)]}
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
          peekRight={rightEdge}
          onChange={(patch) =>
            setSettings((previous) => ({ ...previous, ...patch }))
          }
        />
      ) : null}
    </>
  );
}
