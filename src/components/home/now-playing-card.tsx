"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { usePlayer, usePlayerStatus } from "@/components/player/player-hooks";
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
 * The homepage's top-left card: Paper's "Static player" board.
 *
 * It is a pure view over the app-wide player store. The one hidden YouTube
 * iframe lives in the root provider, so navigation never unmounts the audio and
 * the card shows the same time and state. The card owns the status view;
 * NowPlayingTimebar owns the 4 Hz playhead and pointer preview, so time ticks
 * never re-render the art, title or button.
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
  const { status, track } = usePlayerStatus(store);
  const [showSpinner, setShowSpinner] = useState(false);
  const [artVariant, setArtVariant] = useState<ArtVariant>(MAXRES);
  const [artFailed, setArtFailed] = useState(false);

  const playing = status === "playing" || status === "loading";
  const spinnerVisible = showSpinner && status === "loading";

  // Slow starts show a spinner after 1.5s. Fast starts never flash it.
  useEffect(() => {
    if (status !== "loading") return;

    const id = window.setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);

    return () => {
      window.clearTimeout(id);
      setShowSpinner(false);
    };
  }, [status]);

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

  const buttonLabel =
    status === "error"
      ? `Retry playing ${track.title}`
      : playing
        ? `Pause ${track.title}`
        : `Play ${track.title}`;

  return (
    <div
      role="group"
      aria-label="Now playing"
      data-phase={status}
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
        </div>

        <NowPlayingTimebar store={store} />

        <div className="now-playing-row">
          <div className="now-playing-meta">
            <p className="now-playing-title text-xs font-semibold xl:text-sm">
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
            aria-label={buttonLabel}
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
            <span
              className="now-playing-icon now-playing-spinner"
              data-visible={spinnerVisible ? "true" : "false"}
            >
              <SpinnerIcon />
            </span>
          </button>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {statusText}
        </span>
      </div>
    </div>
  );
}

function NowPlayingTimebar({ store }: { store: PlayerStore }) {
  const { currentTime, duration } = usePlayer(store);
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const scrubRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const previewRef = useRef(0);

  const displayTime = preview ?? currentTime;
  const currentSeconds = Math.max(0, Math.floor(displayTime));
  const totalLabel = formatDuration(duration);
  const elapsedLabel = formatTime(displayTime);
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

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
        // Pointer capture is best effort.
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

  const endScrub = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointerId = pointerIdRef.current;

      if (pointerId === null) return;

      pointerIdRef.current = null;
      setDragging(false);

      try {
        scrubRef.current?.releasePointerCapture(pointerId);
      } catch {
        // The capture was already released.
      }

      if (event.type !== "pointercancel") {
        store.seek(previewRef.current);
      }

      setPreview(null);
    },
    [store],
  );

  const onScrubKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const max = Math.max(1, Math.round(duration));
      let next = displayTime;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next -= 5;
          break;
        case "ArrowRight":
        case "ArrowUp":
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

  return (
    <div className="now-playing-timebar">
      <span
        className="now-playing-elapsed text-xs font-medium tabular-nums"
        aria-hidden="true"
      >
        {elapsedLabel}
      </span>
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
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onLostPointerCapture={endScrub}
        onKeyDown={onScrubKeyDown}
      >
        <div className="now-playing-progress">
          <div className="now-playing-progress-fill" />
        </div>
        <span className="now-playing-progress-thumb" aria-hidden="true" />
      </div>
      <span
        className="now-playing-total text-xs tabular-nums"
        aria-hidden="true"
      >
        {totalLabel}
      </span>
    </div>
  );
}
