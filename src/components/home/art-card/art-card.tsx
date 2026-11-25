"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { RingLayers } from "../ring-hover";
import { ArtDialog } from "./art-dialog";
import { artKicker, formatArtDate, shiftArtDate } from "./art-date";
import { ArtImage, artImageSrc } from "./art-image";
import { PaintingFrame } from "./painting-frame";
import { tiltForDate } from "./tilt";
import "./art-card.css";

/**
 * The home's painting card.
 *
 * Server data is the first frame: the frame already has today's aspect and the
 * wall already has its tint, so hydration changes nothing in layout. The four
 * interactions are deliberately layered:
 *
 * - pointer spotlight: a fine-pointer, no-reduced-motion-only light that follows
 *   the cursor (one rAF write to the light element);
 * - crooked frame: a per-day 1–2° lean that settles straight on card hover;
 * - full view: a native modal dialog with the 1686px image and the museum label;
 * - browse: previous/next buttons that fetch `/api/art/[date]` and keep the old
 *   painting up until the new one arrives.
 */

type ArtCardProps = {
  initialArt: DailyArt;
  /** UTC today, from the server; also the browse window's right edge. */
  today: string;
  /** Oldest day the card may browse, from the server. */
  oldest: string;
};

export function ArtCard({ initialArt, today, oldest }: ArtCardProps) {
  const [art, setArt] = useState(initialArt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsed, setBrowsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cardRef = useRef<HTMLElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const load = useCallback(async (date: string) => {
    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/art/${date}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok)
        throw new Error(`Art request failed: ${response.status}`);

      const next = (await response.json()) as DailyArt;

      if (!next || next.date !== date || typeof next.title !== "string") {
        throw new Error("Art response was not a painting");
      }

      setArt(next);
      setBrowsed(true);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("That day’s painting didn’t load. Try again.");
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Fine-pointer spotlight. Reduced motion and touch keep it dark; the light
  // element gets the only per-frame style write, not the card subtree.
  useEffect(() => {
    const card = cardRef.current;
    const light = lightRef.current;

    if (!card || !light) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let point: { x: number; y: number } | null = null;

    const write = () => {
      frame = 0;

      if (!point) return;

      light.style.setProperty("--art-light-x", `${point.x}px`);
      light.style.setProperty("--art-light-y", `${point.y}px`);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      const rect = card.getBoundingClientRect();

      point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      if (!frame) frame = requestAnimationFrame(write);
    };

    let listening = false;

    const listen = () => {
      if (listening) return;

      listening = true;
      card.addEventListener("pointermove", onMove, { passive: true });
    };

    const unlisten = () => {
      listening = false;
      card.removeEventListener("pointermove", onMove);

      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const sync = () => {
      const on = fine.matches && !calm.matches;

      card.dataset.spotlight = on ? "on" : "off";

      if (on) {
        listen();
      } else {
        unlisten();
        point = null;
      }
    };

    fine.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    sync();

    return () => {
      fine.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
      unlisten();
    };
  }, []);

  const canPrevious = art.date > oldest;
  const canNext = art.date < today;
  const tint = art.color
    ? `hsl(${Math.round(art.color.h)} ${Math.round(art.color.s)}% ${Math.round(art.color.l)}%)`
    : null;

  const goPrevious = () => {
    if (pending || !canPrevious) return;
    void load(shiftArtDate(art.date, -1));
  };

  const goNext = () => {
    if (pending || !canNext) return;
    void load(shiftArtDate(art.date, 1));
  };

  return (
    <article
      ref={cardRef}
      className="ring-host art-card flex-1"
      aria-label="Daily painting"
      aria-busy={pending || undefined}
      data-loading={pending ? "true" : undefined}
      data-browsed={browsed ? "true" : undefined}
      style={
        { "--art-tint": tint ?? "var(--surface-container)" } as CSSProperties
      }
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="art-card-wall" aria-hidden="true">
        <span ref={lightRef} className="art-card-light" />
        <span className="art-card-vignette" />
      </div>

      <span className="art-card-progress" aria-hidden="true" />

      <div className="art-card-body">
        <ArtScene
          key={art.date}
          art={art}
          today={today}
          onOpen={() => setDialogOpen(true)}
        />

        <div
          className="art-card-controls"
          role="group"
          aria-label="Browse paintings"
        >
          <button
            type="button"
            className="art-control"
            aria-label={`Previous painting, ${formatArtDate(shiftArtDate(art.date, -1), today)}`}
            aria-disabled={!canPrevious || pending || undefined}
            disabled={!canPrevious}
            onClick={goPrevious}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            className="art-control"
            aria-label={`Next painting, ${formatArtDate(shiftArtDate(art.date, 1), today)}`}
            aria-disabled={!canNext || pending || undefined}
            disabled={!canNext}
            onClick={goNext}
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      {error ? (
        <p className="art-card-error text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {pending
          ? "Loading that day’s painting…"
          : `Showing ${art.title} by ${art.artist}.`}
      </p>

      {dialogOpen ? (
        <ArtDialog art={art} today={today} open onClose={closeDialog} />
      ) : null}
    </article>
  );
}

/**
 * One artwork's frame + label, keyed by the card at `art.date`.
 *
 * The image-failure state lives here rather than in ArtCard: React unmounts
 * this subtree on every day change, so stepping away and back starts clean,
 * and a successful load clears any note while the scene is alive.
 */
function ArtScene({
  art,
  today,
  onOpen,
}: {
  art: DailyArt;
  today: string;
  onOpen: () => void;
}) {
  const [failureSrc, setFailureSrc] = useState<string | null>(null);
  const imageSrc = art.imageId ? artImageSrc(art.imageId, "card") : null;
  const imageUnavailable = imageSrc !== null && failureSrc === imageSrc;
  const noteId = useId();
  const tilt = tiltForDate(art.date);

  return (
    <div className="art-card-scene">
      <button
        type="button"
        className="art-card-frame-button"
        aria-label={`View ${art.title} by ${art.artist} in full`}
        aria-haspopup="dialog"
        aria-describedby={imageUnavailable ? noteId : undefined}
        onClick={onOpen}
      >
        <PaintingFrame art={art} tilt={tilt}>
          <ArtImage
            art={art}
            onUnavailable={(src) => {
              if (src === imageSrc) setFailureSrc(src);
            }}
            onAvailable={(src) => {
              if (src === imageSrc) setFailureSrc(null);
            }}
          />
        </PaintingFrame>
      </button>

      <div className="art-card-label">
        <p className="art-card-kicker">{artKicker(art.date, today)}</p>
        <h3 className="art-card-title">{art.title}</h3>
        <p className="art-card-artist">{art.artist}</p>
        <p className="art-card-meta">
          {art.dateDisplay} · {art.medium}
        </p>
        {imageUnavailable ? (
          <p className="art-card-image-note">Image unavailable</p>
        ) : null}
      </div>

      {imageUnavailable ? (
        <p id={noteId} className="sr-only">
          Image unavailable. The painting image service did not respond.
        </p>
      ) : null}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={
          direction === "left"
            ? "M9.5 3.5 5 8l4.5 4.5"
            : "M6.5 3.5 11 8l-4.5 4.5"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
