"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { usePlayer } from "@/components/player/player-hooks";
import {
  PauseIcon,
  PlayIcon,
  SpinnerIcon,
} from "@/components/player/player-icons";
import { playerStore } from "@/components/player/player-store";
import type { PlayerStore } from "@/components/player/player-store";
import { RingLayers } from "./ring-hover";
import {
  formatDuration,
  formatTime,
  thumbnailUrl,
  watchUrl,
} from "./now-playing-track";
import "@/components/player/player.css";
import "./now-playing-card.css";

/**
 * The homepage's top-left card: Paper's "Static player · Pulled in" board.
 *
 * It is a pure view over the app-wide player store. The one hidden YouTube
 * iframe lives in the root provider, so navigation never unmounts the audio and
 * every card copy (including a hidden Activity copy) shows the same time and
 * state. The card only owns UI state: the delayed spinner, the drag preview and
 * the artwork fallback.
 *
 * The default surface is row 1 "Current" (flat); ?surface=pulled restores row
 * 2 V1 Frosted for comparison. The album art fills the top, the times and a
 * role="slider" seek bar sit over its bottom gradient, and the title/artist
 * well and play button share the bottom row.
 *
 * The play button, progress fill and scrubber thumb all use the site's nav orb
 * gradient (--orb-gradient in globals.css, painted by OrbHead in
 * home-nav.tsx). The glyph is white in every phase; the measured minimum
 * contrast against the rendered gradient is 2.89:1 Day, 2.18 Dawn, 1.51 Dusk
 * and 2.34 Night. The button carries no shadow, drop-shadow or halo.
 */

type ArtVariant = "maxresdefault" | "hqdefault";

const MAXRES: ArtVariant = "maxresdefault";
const HQ: ArtVariant = "hqdefault";
const SPINNER_DELAY_MS = 1500;

export function NowPlayingCard({
  store = playerStore,
}: {
  store?: PlayerStore;
}) {
  const titleId = useId();
  const player = usePlayer(store);
  const { status, currentTime, duration, track } = player;

  const [showSpinner, setShowSpinner] = useState(false);
  const [artVariant, setArtVariant] = useState<ArtVariant>(MAXRES);
  const [artFailed, setArtFailed] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const previewRef = useRef(0);

  const playing = status === "playing" || status === "loading";
  const spinnerVisible = showSpinner && status === "loading";
  const displayTime = preview ?? currentTime;
  const currentSeconds = Math.max(0, Math.floor(displayTime));
  const totalLabel = formatDuration(duration);
  const elapsedLabel = formatTime(displayTime);
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

  // Slow starts show a spinner after 1.5s. Fast starts never flash it.
  useEffect(() => {
    if (status !== "loading") return;

    const id = window.setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);

    return () => {
      window.clearTimeout(id);
      setShowSpinner(false);
    };
  }, [status]);

  // Dev-only surface comparison. The default is Paper row 1's flat card;
  // ?surface=pulled restores row 2's fill/rim/well. The attribute is set once
  // on the client, so production and ordinary visits never depend on the query.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const card = cardRef.current;

    if (!card) return;

    const surface = new URLSearchParams(window.location.search).get("surface");

    card.dataset.surface = surface === "pulled" ? "pulled" : "flat";
  }, []);

  const previewFromClientX = useCallback(
    (clientX: number) => {
      const scrub = scrubRef.current;

      if (!scrub) return;

      const rect = scrub.getBoundingClientRect();

      if (rect.width <= 0) return;

      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const seconds = fraction * Math.max(1, duration);

      previewRef.current = seconds;
      setPreview(seconds);
    },
    [duration],
  );

  const onScrubPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const scrub = scrubRef.current;

      if (!scrub) return;

      event.preventDefault();
      pointerIdRef.current = event.pointerId;
      setDragging(true);

      try {
        scrub.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is unavailable in some synthetic environments.
      }

      scrub.focus({ preventScroll: true });
      previewFromClientX(event.clientX);
    },
    [previewFromClientX],
  );

  const onScrubPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;

      previewFromClientX(event.clientX);
    },
    [previewFromClientX],
  );

  const finishScrub = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;

      pointerIdRef.current = null;
      setDragging(false);

      try {
        scrubRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // The capture was already released.
      }

      store.seek(previewRef.current);
      setPreview(null);
    },
    [store],
  );

  const onScrubLostPointerCapture = useCallback(() => {
    if (pointerIdRef.current === null) return;

    pointerIdRef.current = null;
    setDragging(false);
    store.seek(previewRef.current);
    setPreview(null);
  }, [store]);

  const onScrubKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const max = Math.max(1, Math.round(duration));
      let next = displayTime;

      switch (event.key) {
        case "ArrowLeft":
          next -= 5;
          break;
        case "ArrowRight":
          next += 5;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = max;
          break;
        case "PageUp":
          next += max * 0.1;
          break;
        case "PageDown":
          next -= max * 0.1;
          break;
        default:
          return;
      }

      event.preventDefault();
      store.seek(Math.max(0, Math.min(max, next)));
      setPreview(null);
    },
    [displayTime, duration, store],
  );

  const statusText =
    status === "loading"
      ? `Loading ${track.title}`
      : status === "playing"
        ? `Playing ${track.title}`
        : status === "paused"
          ? `Paused ${track.title}`
          : status === "error"
            ? "Playback unavailable"
            : "";

  return (
    <div
      ref={cardRef}
      role="group"
      aria-labelledby={titleId}
      data-phase={status}
      data-surface="flat"
      onPointerEnter={store.warm}
      onFocus={store.warm}
      onPointerDown={store.warm}
      className="ring-host now-playing-card flex h-40 w-40 flex-col rounded-lg md:size-[220px] xl:h-[276px] xl:w-[275px]"
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="now-playing-body">
        <div className="now-playing-art">
          {artFailed ? null : (
            <Image
              key={artVariant}
              src={thumbnailUrl(track.videoId, artVariant)}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 350px, (min-width: 768px) 278px, 202px"
              className="now-playing-art-image"
              onError={() => {
                if (artVariant === MAXRES) {
                  setArtVariant(HQ);
                } else {
                  setArtFailed(true);
                }
              }}
            />
          )}

          <div className="now-playing-timebar">
            <div className="now-playing-times" aria-hidden="true">
              <span className="now-playing-elapsed text-xs font-medium tabular-nums">
                {elapsedLabel}
              </span>
              <span className="now-playing-total text-xs tabular-nums">
                {totalLabel}
              </span>
            </div>
            <div
              ref={scrubRef}
              className="now-playing-scrub"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={currentSeconds}
              aria-valuetext={`${formatTime(currentSeconds)} of ${totalLabel}`}
              data-dragging={dragging ? "true" : undefined}
              style={{ "--now-playing-progress": progress } as CSSProperties}
              onPointerDown={onScrubPointerDown}
              onPointerMove={onScrubPointerMove}
              onPointerUp={finishScrub}
              onPointerCancel={finishScrub}
              onLostPointerCapture={onScrubLostPointerCapture}
              onKeyDown={onScrubKeyDown}
            >
              <div className="now-playing-progress">
                <div className="now-playing-progress-fill" />
              </div>
              <span className="now-playing-progress-thumb" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="now-playing-row">
          <div className="now-playing-meta">
            <p
              id={titleId}
              className="now-playing-title text-xs font-semibold xl:text-sm"
            >
              {track.title}
            </p>
            {status === "error" ? (
              <a
                className="now-playing-link text-xs"
                href={watchUrl(track.videoId)}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="now-playing-artist text-xs">{track.artist}</p>
            )}
          </div>

          <button
            type="button"
            className="player-orb-button now-playing-button"
            aria-label={
              playing ? `Pause ${track.title}` : `Play ${track.title}`
            }
            onClick={store.toggle}
          >
            <span
              className="now-playing-icon"
              data-visible={!playing && !spinnerVisible ? "true" : "false"}
            >
              <PlayIcon />
            </span>
            <span
              className="now-playing-icon"
              data-visible={playing && !spinnerVisible ? "true" : "false"}
            >
              <PauseIcon />
            </span>
            {spinnerVisible ? (
              <span
                className="now-playing-icon now-playing-spinner"
                data-visible="true"
              >
                <SpinnerIcon />
              </span>
            ) : null}
          </button>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {statusText}
        </span>
      </div>
    </div>
  );
}
