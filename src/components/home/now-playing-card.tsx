"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RingLayers } from "./ring-hover";
import {
  NOW_PLAYING_TRACK,
  formatDuration,
  formatTime,
  thumbnailUrl,
  watchUrl,
} from "./now-playing-track";
import { createYouTubePlayer, loadYouTubeApi } from "./now-playing-youtube";
import type { YouTubeHandle } from "./now-playing-youtube";
import "./now-playing-card.css";

/**
 * The homepage's top-left card: Paper's "Static player · Pulled in" row 2,
 * V1 Frosted, at 275×276 and scaled down with container units.
 *
 * The card is flush with the page — the surface is the page token, with the
 * soft white inset rim carrying the edge. The album art fills the top, the
 * times and progress sit over its bottom gradient, and the title/artist well
 * and play button share the bottom row.
 *
 * Playback is the same lazy, hidden youtube-nocookie embed as before. Activity
 * hides home copies on / and /work; this card pauses on effect cleanup and
 * re-syncs when revealed, so two home copies can never be audible at once. The
 * YouTube iframe also re-fires ready after a hidden route is restored, so the
 * ready handler distinguishes the first cue from a re-init and restores the
 * frozen playhead instead of treating it as a new track.
 */

type Phase = "idle" | "loading" | "playing" | "paused" | "error";

const SPINNER_DELAY_MS = 1500;
const LOAD_TIMEOUT_MS = 10000;
const MAXRES = "maxresdefault" as const;
const HQ = "hqdefault" as const;

export function NowPlayingCard() {
  const titleId = useId();

  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [elapsedLabel, setElapsedLabel] = useState("0:00");
  const lastElapsedRef = useRef("0:00");
  const [totalLabel, setTotalLabel] = useState<string>(
    NOW_PLAYING_TRACK.durationLabel,
  );
  const [showSpinner, setShowSpinner] = useState(false);
  const [artVariant, setArtVariant] = useState<typeof MAXRES | typeof HQ>(
    MAXRES,
  );
  const [artFailed, setArtFailed] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubeHandle | null>(null);
  const playerPromiseRef = useRef<Promise<YouTubeHandle | null> | null>(null);
  const playTokenRef = useRef(0);
  const durationRef = useRef<number>(NOW_PLAYING_TRACK.durationSeconds);
  const lastTimeRef = useRef(0);
  const hasReadyRef = useRef(false);
  const warmAttemptedRef = useRef(false);

  const setProgress = useCallback((fraction: number) => {
    const fill = progressRef.current;

    if (!fill) return;

    const clamped = Math.max(0, Math.min(1, fraction));

    fill.style.transform = `scaleX(${clamped})`;
  }, []);

  const syncTime = useCallback(() => {
    const player = playerRef.current;

    if (!player) return;

    try {
      const current = player.currentTime();

      lastTimeRef.current = current;

      const label = formatTime(current);

      if (label !== lastElapsedRef.current) {
        lastElapsedRef.current = label;
        setElapsedLabel(label);
      }

      setProgress(current / Math.max(1, durationRef.current));
    } catch {
      // The player can stop answering between a tick and this read.
    }
  }, [setProgress]);

  const resetTime = useCallback(() => {
    lastTimeRef.current = 0;
    lastElapsedRef.current = "0:00";
    setElapsedLabel("0:00");
    setProgress(0);
  }, [setProgress]);

  const fail = useCallback(() => {
    const current = phaseRef.current;

    // A warm player can error while it is only cued. That is not a failed
    // play yet; the click will create a fresh one and surface the link then.
    if (current === "idle" || current === "error") return;

    playTokenRef.current += 1;
    setShowSpinner(false);

    try {
      playerRef.current?.pause();
    } catch {
      // The player is already torn down.
    }

    setPhase("error");
    resetTime();
  }, [resetTime, setPhase]);

  const handleEnded = useCallback(() => {
    const current = phaseRef.current;

    if (current === "idle" || current === "error") return;

    setShowSpinner(false);
    setPhase("idle");
    resetTime();
  }, [resetTime, setPhase]);

  const ensurePlayer = useCallback(async (): Promise<YouTubeHandle | null> => {
    if (playerRef.current) return playerRef.current;
    if (playerPromiseRef.current) return playerPromiseRef.current;

    const host = hostRef.current;

    if (!host || !host.isConnected) return null;

    const promise = (async (): Promise<YouTubeHandle | null> => {
      try {
        await loadYouTubeApi();
      } catch {
        return null;
      }

      if (!host.isConnected) return null;

      return await new Promise<YouTubeHandle | null>((resolve) => {
        let settled = false;

        const settle = (value: YouTubeHandle | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        try {
          createYouTubePlayer(host, NOW_PLAYING_TRACK.videoId, {
            onReady: (handle, _state, duration) => {
              const firstReady = !hasReadyRef.current;

              hasReadyRef.current = true;
              playerRef.current = handle;

              if (duration > 0) {
                durationRef.current = duration;
                setTotalLabel(formatDuration(duration));
              }

              // The embed is audio-only: keep it out of the tab order and the
              // accessibility tree even though it is also off-screen.
              const iframe = host.querySelector("iframe");

              if (iframe) {
                iframe.tabIndex = -1;
                iframe.setAttribute("aria-hidden", "true");
              }

              if (firstReady) {
                settle(handle);
                return;
              }

              /*
               * The iframe re-initialises when its route has been hidden by
               * Activity (YouTube fires ready again with the playhead at 0).
               * That is not a fresh track: restore the frozen position instead
               * of showing a paused card at 0:00.
               */
              const live = phaseRef.current;
              const resumeAt = lastTimeRef.current;

              try {
                if (live === "playing" || live === "loading") {
                  handle.seek(resumeAt);
                  handle.play();
                } else if (live === "paused") {
                  handle.seek(resumeAt);
                  handle.pause();
                }
              } catch {
                // A re-ready can race the iframe swap; the next event wins.
              }

              settle(handle);
            },
            onStateChange: (state, handle) => {
              if (state === 1) {
                const live = phaseRef.current;

                if (live !== "loading" && live !== "playing") {
                  // A stale play request must never win over a pause or a
                  // return to rest.
                  try {
                    handle.pause();
                  } catch {
                    // Already torn down.
                  }
                  return;
                }

                if (live === "loading") {
                  setShowSpinner(false);
                  setPhase("playing");
                }

                const duration = handle.duration();

                if (duration > 0) {
                  durationRef.current = duration;
                  setTotalLabel(formatDuration(duration));
                }
              } else if (state === 2) {
                if (
                  phaseRef.current === "loading" ||
                  phaseRef.current === "playing"
                ) {
                  setShowSpinner(false);
                  setPhase("paused");
                }
              } else if (state === 0) {
                handleEnded();
              }
            },
            onError: () => {
              settle(null);
              fail();
            },
          });
        } catch {
          settle(null);
        }
      });
    })();

    playerPromiseRef.current = promise;

    const handle = await promise;

    if (!handle) playerPromiseRef.current = null;

    return handle;
  }, [fail, handleEnded, setPhase]);

  const beginPlay = useCallback(() => {
    setShowSpinner(false);

    const current = phaseRef.current;
    const player = playerRef.current;

    if (current === "paused" && player) {
      setPhase("playing");

      try {
        player.play();
      } catch {
        fail();
      }

      return;
    }

    setPhase("loading");
    resetTime();

    const token = ++playTokenRef.current;

    void ensurePlayer()
      .then((handle) => {
        if (token !== playTokenRef.current) return;
        if (!handle) {
          fail();
          return;
        }
        if (phaseRef.current !== "loading") return;

        try {
          handle.seek(0);
          handle.play();
        } catch {
          fail();
        }
      })
      .catch(() => {
        if (token === playTokenRef.current) fail();
      });
  }, [ensurePlayer, fail, resetTime, setPhase]);

  const pause = useCallback(() => {
    syncTime();

    try {
      playerRef.current?.pause();
    } catch {
      // Already torn down.
    }

    setShowSpinner(false);
    setPhase("paused");
  }, [setPhase, syncTime]);

  const cancelLoading = useCallback(() => {
    playTokenRef.current += 1;

    try {
      playerRef.current?.pause();
      playerRef.current?.seek(0);
    } catch {
      // The player never became ready.
    }

    setShowSpinner(false);
    resetTime();
    setPhase("idle");
  }, [resetTime, setPhase]);

  const toggle = useCallback(() => {
    const current = phaseRef.current;

    if (current === "playing") {
      pause();
      return;
    }

    if (current === "loading") {
      cancelLoading();
      return;
    }

    beginPlay();
  }, [beginPlay, cancelLoading, pause]);

  const warmPlayer = useCallback(() => {
    if (
      warmAttemptedRef.current ||
      playerRef.current ||
      playerPromiseRef.current
    ) {
      return;
    }

    warmAttemptedRef.current = true;
    void ensurePlayer();
  }, [ensurePlayer]);

  // Dev-only surface comparison. The default is Paper row 1's flat card;
  // ?surface=pulled restores row 2's fill/rim/well. The attribute is set once
  // on the client, so production and ordinary visits never depend on the query
  // and no React state is involved.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const card = cardRef.current;

    if (!card) return;

    const surface = new URLSearchParams(window.location.search).get("surface");

    card.dataset.surface = surface === "pulled" ? "pulled" : "flat";
  }, []);

  // Activity unmounts a hidden route's effects. Pausing here is what makes /
  // and /work mutually exclusive; on reveal the one-frame sync below catches a
  // player that paused or kept going behind the Activity boundary.
  useEffect(() => {
    const syncPlayer = () => {
      const player = playerRef.current;

      if (!player) return;

      try {
        const state = player.state();
        const current = phaseRef.current;

        if (state === 1 || state === 3) {
          player.pause();

          if (
            current === "playing" ||
            current === "loading" ||
            current === "paused"
          ) {
            setShowSpinner(false);
            setPhase("paused");
          }
        } else if (state === 2) {
          if (current === "playing" || current === "loading") {
            setShowSpinner(false);
            setPhase("paused");
          }
        }
      } catch {
        // The iframe is still being replaced.
      }
    };

    const frame = window.requestAnimationFrame(syncPlayer);

    const pauseCopy = () => {
      const live = phaseRef.current;

      if (live === "playing" || live === "loading" || live === "paused") {
        syncTime();
      }

      try {
        playerRef.current?.pause();
      } catch {
        // Already torn down.
      }

      if (live === "playing" || live === "loading") {
        setShowSpinner(false);
        setPhase("paused");
      }
    };

    const onVisibility = () => {
      if (document.hidden) pauseCopy();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      pauseCopy();
    };
  }, [setPhase, syncTime]);

  // Belt for Activity: a hidden copy has no box even if its effects have not
  // been cleaned up yet. One rect read per 750ms, only while audio could run.
  useEffect(() => {
    if (phase !== "playing" && phase !== "loading") return;

    const id = window.setInterval(() => {
      const card = cardRef.current;

      if (!card || !card.isConnected || card.getClientRects().length === 0) {
        try {
          playerRef.current?.pause();
        } catch {
          // Already torn down.
        }

        const current = phaseRef.current;

        if (current === "playing" || current === "loading") {
          setShowSpinner(false);
          setPhase("paused");
        }
      }
    }, 750);

    return () => window.clearInterval(id);
  }, [phase, setPhase]);

  // Elapsed time in tabular numbers, at most one text update per second. The
  // fill is scaleX, updated four times a second so it glides between seconds.
  useEffect(() => {
    if (phase !== "playing") return;

    const update = () => {
      const player = playerRef.current;

      if (!player) return;

      try {
        const current = player.currentTime();
        const label = formatTime(current);

        lastTimeRef.current = current;

        if (label !== lastElapsedRef.current) {
          lastElapsedRef.current = label;
          setElapsedLabel(label);
        }

        setProgress(current / Math.max(1, durationRef.current));
      } catch {
        // The player can stop answering between a tick and this read.
      }
    };

    update();
    const id = window.setInterval(update, 250);

    return () => window.clearInterval(id);
  }, [phase, setProgress]);

  // Slow starts show a spinner after 1.5s. Fast starts never flash it.
  useEffect(() => {
    if (phase !== "loading") return;

    const id = window.setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);

    return () => window.clearTimeout(id);
  }, [phase]);

  // The embed can be blocked without the API firing an error. If the click has
  // not become audio after 10s, fall back to the link. A buffering player is
  // left alone; a paused one becomes a resumable pause.
  useEffect(() => {
    if (phase !== "loading") return;

    const id = window.setTimeout(() => {
      if (phaseRef.current !== "loading") return;

      let state = -1;

      try {
        state = playerRef.current?.state() ?? -1;
      } catch {
        // No player handle.
      }

      if (state === 1 || state === 3) return;

      if (state === 2) {
        setShowSpinner(false);
        setPhase("paused");
        return;
      }

      fail();
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(id);
  }, [fail, phase, setPhase]);

  const playing = phase === "playing" || phase === "loading";
  const spinnerVisible = showSpinner && phase === "loading";

  const status =
    phase === "loading"
      ? `Loading ${NOW_PLAYING_TRACK.title}`
      : phase === "playing"
        ? `Playing ${NOW_PLAYING_TRACK.title}`
        : phase === "paused"
          ? `Paused ${NOW_PLAYING_TRACK.title}`
          : phase === "error"
            ? "Playback unavailable"
            : "";

  return (
    <div
      ref={cardRef}
      role="group"
      aria-labelledby={titleId}
      data-phase={phase}
      data-surface="flat"
      onPointerEnter={warmPlayer}
      onFocus={warmPlayer}
      onPointerDown={warmPlayer}
      className="ring-host now-playing-card flex h-40 w-40 flex-col rounded-lg md:size-[220px] xl:h-[276px] xl:w-[275px]"
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="now-playing-body">
        <div className="now-playing-art" aria-hidden="true">
          {artFailed ? null : (
            <Image
              key={artVariant}
              src={thumbnailUrl(NOW_PLAYING_TRACK.videoId, artVariant)}
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
            <div className="now-playing-times">
              <span className="now-playing-elapsed">{elapsedLabel}</span>
              <span className="now-playing-total">{totalLabel}</span>
            </div>
            <div className="now-playing-progress">
              <div ref={progressRef} className="now-playing-progress-fill" />
            </div>
          </div>
        </div>

        <div className="now-playing-row">
          <div className="now-playing-meta">
            <p id={titleId} className="now-playing-title">
              {NOW_PLAYING_TRACK.title}
            </p>
            {phase === "error" ? (
              <a
                className="now-playing-link"
                href={watchUrl(NOW_PLAYING_TRACK.videoId)}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="now-playing-artist">{NOW_PLAYING_TRACK.artist}</p>
            )}
          </div>

          <button
            type="button"
            className="now-playing-button"
            aria-label={playing ? "Pause" : `Play ${NOW_PLAYING_TRACK.title}`}
            onClick={toggle}
          >
            <span
              className="now-playing-icon"
              data-visible={!playing && !spinnerVisible ? "true" : "false"}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path d="M4 1.75 L10.5 6 L4 10.25 Z" fill="currentColor" />
              </svg>
            </span>
            <span
              className="now-playing-icon"
              data-visible={playing && !spinnerVisible ? "true" : "false"}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="1.75"
                  width="2.5"
                  height="8.5"
                  rx="0.75"
                  fill="currentColor"
                />
                <rect
                  x="6.5"
                  y="1.75"
                  width="2.5"
                  height="8.5"
                  rx="0.75"
                  fill="currentColor"
                />
              </svg>
            </span>
            {spinnerVisible ? (
              <span
                className="now-playing-icon now-playing-spinner"
                data-visible="true"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M6 1.5A4.5 4.5 0 0 1 10.5 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            ) : null}
          </button>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      <div
        ref={hostRef}
        className="now-playing-player-host"
        aria-hidden="true"
      />
    </div>
  );
}
