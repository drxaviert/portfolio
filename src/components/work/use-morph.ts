"use client";

import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { flipFrom, toBox } from "./morph";
import type { Box } from "./morph";
import { announceOverlayExit } from "./overlay-exit";
import { READER_TITLE_ID } from "./parts";

export type MorphPhase = "opening" | "open" | "closing";

/** Content entrance: held while the panel morphs, released before it lands. */
export type RevealState = "pending" | "on";

type Morph = ReturnType<typeof animate>;

const EASE_ENTER: [number, number, number, number] = [0.32, 0.72, 0, 1];
const MORPH_S = 0.48;
const CLOSE_S = 0.3;
const FADE_S = 0.12;
/** The entrance starts this long before the morph lands, so reading does not wait for it. */
const REVEAL_LEAD_S = 0.12;

export function cardSelector(slug: string): string {
  return `[data-work-card="${slug}"]`;
}

/** The source card, measured now. Close calls this again for the live rect. */
export function findCard(
  slug: string,
): { card: Box; title: Box | null } | null {
  // Below md the stacked card and the carousel card can both exist; only the
  // one that is laid out (display: none has no box) is the morph's source.
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(cardSelector(slug)),
  );
  const card =
    candidates.find((candidate) => candidate.getClientRects().length > 0) ??
    candidates[0];
  if (!card) return null;

  const title = card.querySelector<HTMLElement>("[data-work-card-title]");

  return {
    card: toBox(card.getBoundingClientRect()),
    title: title ? toBox(title.getBoundingClientRect()) : null,
  };
}

/**
 * The panel's untransformed layout box. `offsetLeft`/`offsetTop` ignore the
 * transform, so a close during the open morph still knows where the panel will
 * settle on screen.
 */
function layoutBox(panel: HTMLElement): Box {
  const rect = panel.getBoundingClientRect();

  return {
    left: panel.offsetLeft,
    top: panel.offsetTop,
    width: panel.offsetWidth || rect.width,
    height: panel.offsetHeight || rect.height,
  };
}

function setPose(
  panel: HTMLElement,
  pose: { x: number; y: number; scaleX: number; scaleY: number },
) {
  panel.style.transformOrigin = "top left";
  panel.style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${pose.scaleX}, ${pose.scaleY})`;
}

/**
 * The title clone keeps the destination's type size, so the honest uniform
 * scale is the font-size ratio. Scaling by the two block widths would stretch
 * the glyphs to the card's column width instead of matching its text.
 */
function titleScale(from: HTMLElement, to: HTMLElement): number {
  const source = Number.parseFloat(getComputedStyle(from).fontSize);
  const target = Number.parseFloat(getComputedStyle(to).fontSize);

  return source && target ? source / target : 1;
}

export function useMorph(
  slug: string,
  panelRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLElement | null>,
): { phase: MorphPhase; reveal: RevealState; close: () => Promise<void> } {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<MorphPhase>("opening");
  const [reveal, setReveal] = useState<RevealState>("pending");
  const openingRef = useRef<Morph | null>(null);
  const flightRef = useRef<Morph | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  const closingRef = useRef<Promise<void> | null>(null);
  const revealTimerRef = useRef(0);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = 0;
    }
  }, []);

  const settle = useCallback(() => {
    if (closedRef.current) return;

    clearRevealTimer();
    setReveal("on");

    const panel = panelRef.current;
    panel?.style.removeProperty("transform");
    panel?.style.removeProperty("opacity");

    setPhase("open");

    const title = titleRef.current;
    if (flightRef.current) {
      flightRef.current = null;
      animate(
        title,
        { opacity: 0 },
        { duration: 0.18, ease: "easeOut", delay: 0.05 },
      );
    }
  }, [panelRef, titleRef, setPhase, clearRevealTimer]);

  const startTitleFlight = useCallback(
    (
      card: { card: Box; title: Box | null },
      target: Box,
      targetEl: HTMLElement,
    ) => {
      const title = titleRef.current;
      const source = document.querySelector<HTMLElement>(
        `${cardSelector(slug)} [data-work-card-title]`,
      );
      const text = source?.textContent?.trim();
      if (!title || !card.title || !source || !text) return;

      title.textContent = text;
      title.style.left = `${target.left}px`;
      title.style.top = `${target.top}px`;
      title.style.width = `${target.width}px`;
      title.style.opacity = "1";

      const pose = flipFrom(card.title, target);
      const scale = titleScale(source, targetEl);
      title.style.transformOrigin = "top left";
      title.style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${scale})`;

      flightRef.current = animate(
        title,
        { x: 0, y: 0, scale: 1 },
        { duration: MORPH_S, ease: EASE_ENTER },
      );
    },
    [slug, titleRef],
  );

  // Measure once, before the first paint, then animate from the card to the
  // panel's own layout box. Nothing here reads geometry after the morph.
  useLayoutEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    window.history.replaceState(
      { ...window.history.state, workOverlay: true },
      "",
    );

    const panel = panelRef.current;
    if (!panel) return;

    const card = findCard(slug);

    if (reduce) {
      panel.style.opacity = "0";
      const fade = animate(
        panel,
        { opacity: 1 },
        { duration: FADE_S, ease: "easeOut" },
      );
      openingRef.current = fade;
      void fade.finished.then(settle);
      return;
    }

    // "Next project" opens a study with no card to morph from. The panel is
    // already the destination, so it keeps its opaque surface and only the new
    // content changes: a fade here would show the homepage through the reader.
    if (!card) {
      settle();
      return;
    }

    const target = panel.querySelector<HTMLElement>(`#${READER_TITLE_ID}`);
    const targetBox = target ? toBox(target.getBoundingClientRect()) : null;
    const layout = layoutBox(panel);

    setPose(panel, flipFrom(card.card, layout));

    const morph = animate(
      panel,
      { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      { duration: MORPH_S, ease: EASE_ENTER },
    );
    openingRef.current = morph;
    void morph.finished.then(settle);

    // The content starts arriving under the landing panel rather than after
    // it, so the reader is readable at the moment the morph ends.
    revealTimerRef.current = window.setTimeout(
      () => setReveal("on"),
      (MORPH_S - REVEAL_LEAD_S) * 1000,
    );

    if (target && targetBox) startTitleFlight(card, targetBox, target);
  }, [slug, reduce, panelRef, settle, startTitleFlight]);

  // A resize mid-morph jumps to the end; after that the panel is pure CSS, so
  // the new viewport just reflows it and close measures the card again.
  useEffect(() => {
    if (phase !== "opening") return;

    const onResize = () => openingRef.current?.complete();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [phase]);

  // The entrance timer must not fire into a closed reader.
  useEffect(() => clearRevealTimer, [clearRevealTimer]);

  /** Runs the reverse morph, then leaves the route. One flight at a time. */
  const close = useCallback(() => {
    if (closingRef.current) return closingRef.current;

    closingRef.current = (async () => {
      if (closedRef.current) return;

      clearRevealTimer();
      setPhase("closing");
      openingRef.current?.stop();

      const panel = panelRef.current;
      if (!panel) return;

      const card = findCard(slug);

      if (!card || reduce) {
        await animate(
          panel,
          { opacity: 0 },
          { duration: FADE_S, ease: "easeOut" },
        ).finished;
      } else {
        const pose = flipFrom(card.card, layoutBox(panel));
        await animate(panel, pose, { duration: CLOSE_S, ease: "easeIn" })
          .finished;
      }

      closedRef.current = true;
      panel.style.removeProperty("transform");
      panel.style.opacity = "0";
      announceOverlayExit();

      if (window.location.pathname !== `/work/${slug}`) return;

      if (window.history.state?.workOverlay) router.back();
      else router.push("/");
    })();

    return closingRef.current;
  }, [slug, reduce, panelRef, router, setPhase, clearRevealTimer]);

  return { phase, reveal, close };
}
