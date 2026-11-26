"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { artSynopsis } from "@/lib/art-shared";
import type { DailyArt } from "@/lib/daily-art";
import { RingLayers } from "../ring-hover";
import { ArtDialog } from "./art-dialog";
import { ArtImage, artImageSrc } from "./art-image";
import { PaintingFrame } from "./painting-frame";
import "./art-card.css";

/**
 * The home's daily painting card.
 *
 * Server data is the first frame: the frame already has today's aspect and the
 * wall already has its tint, so hydration changes nothing in layout. The label
 * sits on the left and the frame on the right. Two interactions remain:
 *
 * - pointer spotlight: a fine-pointer, no-reduced-motion-only light that follows
 *   the cursor (one rAF write to the light element);
 * - full view: a native modal dialog with the 1686px image and the museum label.
 *
 * There is one painting per UTC day; no browsing state, controls or date fetch.
 */

type ArtCardProps = {
  art: DailyArt;
};

export function ArtCard({ art }: ArtCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const cardRef = useRef<HTMLElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

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

  return (
    <article
      ref={cardRef}
      className="ring-host art-card flex-1"
      aria-label="Daily painting"
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="art-card-wall" aria-hidden="true">
        <span ref={lightRef} className="art-card-light" />
        <span className="art-card-vignette" />
      </div>

      <div className="art-card-body">
        <ArtScene key={art.date} art={art} onOpen={() => setDialogOpen(true)} />
      </div>

      {dialogOpen ? <ArtDialog art={art} open onClose={closeDialog} /> : null}
    </article>
  );
}

/**
 * One artwork's label + frame. The image-failure state lives here so a scene
 * remount starts clean; the card itself has no changing art to reset.
 */
function ArtScene({ art, onOpen }: { art: DailyArt; onOpen: () => void }) {
  const [failureSrc, setFailureSrc] = useState<string | null>(null);
  const imageSrc = art.imageId ? artImageSrc(art.imageId, "card") : null;
  const imageUnavailable = imageSrc !== null && failureSrc === imageSrc;
  const noteId = useId();
  const synopsis = artSynopsis(art);

  return (
    <div className="art-card-scene">
      <div className="art-card-label">
        <p className="art-card-kicker">Today’s painting</p>
        <h3 className="art-card-title">{art.title}</h3>
        <p className="art-card-artist">{art.artist}</p>
        <p className="art-card-meta">
          {art.dateDisplay} · {art.medium}
        </p>
        <p className="art-card-synopsis">{synopsis}</p>
        {imageUnavailable ? (
          <p className="art-card-image-note">Image unavailable</p>
        ) : null}
      </div>

      <button
        type="button"
        className="art-card-frame-button"
        aria-label={`View ${art.title} by ${art.artist} in full`}
        aria-haspopup="dialog"
        aria-describedby={imageUnavailable ? noteId : undefined}
        onClick={onOpen}
      >
        <PaintingFrame art={art}>
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

      {imageUnavailable ? (
        <p id={noteId} className="sr-only">
          Image unavailable. The painting image service did not respond.
        </p>
      ) : null}
    </div>
  );
}
