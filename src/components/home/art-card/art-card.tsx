"use client";

import { useCallback, useId, useState } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { RingLayers } from "../ring-hover";
import { ArtDialog } from "./art-dialog";
import { ArtImage, artImageSrc } from "./art-image";
import { PaintingFrame } from "./painting-frame";
import "./art-card.css";

/**
 * The home's daily painting card.
 *
 * Server data is the first frame: the frame already has today's aspect, so
 * hydration changes nothing in layout. The card is the plain ring surface the
 * other home cards use; the label sits left and the frame right. One
 * interaction remains: the full view, a native modal dialog with the 1686px
 * image and the museum label.
 *
 * There is one painting per UTC day; no browsing state, controls or date fetch.
 */

type ArtCardProps = {
  art: DailyArt;
};

export function ArtCard({ art }: ArtCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  return (
    <article
      className="ring-host art-card flex-1 rounded-lg"
      aria-label="Daily painting"
    >
      <RingLayers fill="bg-surface-container-low" />

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
  const meta = [art.dateDisplay, art.medium].filter(Boolean).join(" · ");

  return (
    <div className="art-card-scene">
      <div className="art-card-label">
        <p className="art-card-kicker">Today’s painting</p>
        <h3 className="art-card-title">{art.title}</h3>
        <p className="art-card-artist">{art.artist}</p>
        {meta ? <p className="art-card-meta">{meta}</p> : null}
        <p className="art-card-synopsis">{art.synopsis}</p>
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
