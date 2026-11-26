"use client";

import { useEffect, useId, useRef, useState } from "react";
import { artSynopsis } from "@/lib/art-shared";
import type { DailyArt } from "@/lib/daily-art";
import { ArtImage, artImageSrc } from "./art-image";
import { PaintingFrame } from "./painting-frame";

/**
 * Full view: a native modal <dialog>.
 *
 * `showModal()` gives the top layer, the inert page behind, Esc-to-close and
 * the focus trap; the explicit Tab handler and Esc key listener make the same
 * guarantees in environments whose <dialog> implementation is incomplete, and
 * keep the close path identical in tests. Focus goes to Close on open and back
 * to the frame button on close.
 */

type ArtDialogProps = {
  art: DailyArt;
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ArtDialog({ art, open, onClose }: ArtDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const titleId = useId();
  const imageSrc = art.imageId ? artImageSrc(art.imageId, "full") : null;
  const [failureSrc, setFailureSrc] = useState<string | null>(null);
  const imageUnavailable = imageSrc !== null && failureSrc === imageSrc;
  const synopsis = artSynopsis(art);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;

    if (!dialog) return;

    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const bodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    closeRef.current?.focus({ preventScroll: true });

    const close = () => {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
        onClose();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;

      if (dialog.open) {
        if (typeof dialog.close === "function") {
          // The dialog is unmounting because the parent already closed it.
          // Its close event must not call onClose again; in StrictMode the
          // simulated cleanup would otherwise close the re-mounted dialog.
          closingRef.current = true;
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      }

      if (returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleNativeClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }

    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="art-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onClose={handleNativeClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;

        const dialog = dialogRef.current;

        if (!dialog) return;

        if (typeof dialog.close === "function") dialog.close();
        else onClose();
      }}
    >
      <div className="art-dialog-panel">
        <button
          ref={closeRef}
          type="button"
          className="art-dialog-close"
          aria-label="Close full view"
          onClick={onClose}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
              d="M5 5l10 10M15 5 5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="art-dialog-stage">
          <PaintingFrame art={art} variant="full">
            <ArtImage
              art={art}
              variant="full"
              onUnavailable={(src) => {
                if (src === imageSrc) setFailureSrc(src);
              }}
              onAvailable={(src) => {
                if (src === imageSrc) setFailureSrc(null);
              }}
            />
          </PaintingFrame>
        </div>

        <div className="art-dialog-copy">
          <p className="art-dialog-kicker">Today’s painting</p>
          <h2 id={titleId} className="art-dialog-title">
            {art.title}
          </h2>
          <p className="art-dialog-artist">{art.artist}</p>
          <p className="art-dialog-synopsis">{synopsis}</p>

          {imageUnavailable ? (
            <p className="art-dialog-note" role="status">
              The image service did not respond, so the painting itself could
              not be loaded. The record and the Art Institute link are still
              valid.
            </p>
          ) : null}

          {art.fallback ? (
            <p className="art-dialog-note">
              The Art Institute could not be reached, so this is a bundled
              stand-in. Close and try again in a little while.
            </p>
          ) : (
            <dl className="art-dialog-facts">
              <div>
                <dt>Date</dt>
                <dd>{art.dateDisplay}</dd>
              </div>
              <div>
                <dt>Medium</dt>
                <dd>{art.medium}</dd>
              </div>
              {art.placeOfOrigin ? (
                <div>
                  <dt>Origin</dt>
                  <dd>{art.placeOfOrigin}</dd>
                </div>
              ) : null}
              {art.styleTitle ? (
                <div>
                  <dt>Style</dt>
                  <dd>{art.styleTitle}</dd>
                </div>
              ) : null}
            </dl>
          )}

          {art.articUrl ? (
            <a
              className="art-dialog-link"
              href={art.articUrl}
              target="_blank"
              rel="noreferrer"
            >
              View at the Art Institute of Chicago
              <span aria-hidden="true"> ↗</span>
            </a>
          ) : null}

          <p className="art-dialog-day">
            Chosen for today
            <span className="sr-only">. One painting per UTC day.</span>
          </p>
        </div>
      </div>
    </dialog>
  );
}
