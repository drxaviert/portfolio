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
import type { KeyboardEvent, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { WORK_SLIVERS } from "../home-cards";
import { RingLayers } from "../ring-hover";
import { restStyle, playEntity } from "./carousel-dom";
import {
  EMPTY_GEOMETRY,
  GAP,
  VISIBLE_SLOTS,
  advance,
  clickAction,
  easeFn,
  entityKey,
  keyStep,
  linearEasing,
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
  animations: Animation[];
};

const FALLBACK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const CROSSFADE_MS = 120;

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
  fillSlot,
  register,
  onActivate,
}: SlideProps) {
  const first = slot === 0 && !ghost;
  const offscreen = slot >= VISIBLE_SLOTS;
  const key = `${ghost ? "g" : "m"}${index}`;
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
      className="car-slide"
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

  const rowRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const geometry = useRef<Geometry>(EMPTY_GEOMETRY);
  const offsetRef = useRef(0);
  const tween = useRef<Tween | null>(null);
  const focusFirst = useRef(false);
  const latest = useRef({ settings, mode, reduce });

  useEffect(() => {
    latest.current = { settings, mode, reduce };
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
    current?.animations.forEach((animation) => animation.cancel());
  }

  /** Ends the running step now: every card at rest, the seam copy dropped. */
  function settle() {
    if (!tween.current) return;

    cancelTween();
    applyRest(offsetRef.current);
    setGhosts([]);
    setDomOffset(offsetRef.current);
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

    const { settings: s, mode: m, reduce: reduced } = latest.current;
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
      return;
    }

    const ease = easeFn(s.ease);
    const timing: TitleTiming = {
      delay: s.titleDelay,
      duration: s.titleDuration,
      outDuration: Math.min(120, s.titleDuration),
    };
    const running = tween.current;
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
    const planned = retarget(g, n, prev, k, current);

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

    const easing = supportsLinearEasing()
      ? linearEasing(ease)
      : FALLBACK_EASING;
    const animations: Animation[] = [];

    for (const entity of planned) {
      const element = elements.current.get(entityKey(entity));
      if (!element) continue;

      animations.push(
        ...playEntity(element, entity, {
          duration: s.duration,
          easing,
          mode: m,
          timing,
        }),
      );
    }

    // One clock ends the step; the title may outlast the cards.
    const clock = row.animate(
      { opacity: [1, 1] },
      { duration: Math.max(s.duration, s.titleDelay + s.titleDuration) },
    );
    const started: Tween = {
      entities: planned,
      t0: now,
      duration: s.duration,
      ease,
      timing,
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
  }, [mode]);

  // The DOM only reorders between steps, which can drop focus; put it back on
  // the first card if the step came from the keyboard.
  useLayoutEffect(() => {
    if (!focusFirst.current) return;

    focusFirst.current = false;
    if (!tween.current)
      firstCard(offsetRef.current)?.focus({ preventScroll: true });
  }, [domOffset]);

  function onActivate(event: MouseEvent<HTMLElement>, index: number) {
    const slot = slotOf(index, offsetRef.current, n);
    const action = clickAction(slot, items[index].kind);

    if (action.type === "open") {
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

  return (
    <>
      <section
        aria-roledescription="carousel"
        aria-label="Selected work"
        onKeyDown={onKeyDown}
        className="hidden md:block"
      >
        <div ref={rowRef} className="car-row">
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
          onChange={(patch) =>
            setSettings((previous) => ({ ...previous, ...patch }))
          }
        />
      ) : null}
    </>
  );
}
