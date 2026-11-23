"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RingLayers } from "./ring-hover";
import { useReducedMotion } from "./use-reduced-motion";
import { VINYL_TRACK, formatTime, thumbnailUrl, watchUrl } from "./vinyl-track";
import { createVinylSpin } from "./vinyl-spin";
import type { VinylSpin } from "./vinyl-spin";
import { createYouTubePlayer, loadYouTubeApi } from "./vinyl-youtube";
import type { YouTubeHandle } from "./vinyl-youtube";
import "./vinyl-card.css";

/**
 * The homepage's top-left card, playing 「不停的」 through a hidden, lazy
 * YouTube embed.
 *
 * The card is drawn at 275×276 in Paper and scaled with container units (see
 * vinyl-card.css), so the same geometry reads at 160, 220 and 275. The card
 * itself stays hover-only; the play button and the error link are the only
 * interactive things.
 *
 * Playback is optimistic: the disc slides out and spins up on click, before the
 * iframe has answered. YouTube events correct the state, a 1.5s timer reveals
 * the spinner if the start is slow, and a 10s watchdog falls back to the
 * YouTube link when the embed is blocked or offline.
 *
 * Activity keeps hidden copies of HomeScreen alive on / and /work. This
 * component pauses its player whenever its effects are cleaned up (Activity
 * hides a route) and also checks that the card still has a box while audio
 * could be running; a hidden copy can never stay audible. The spin is WAAPI,
 * so the once-a-second time update never touches it.
 */

type Phase =
  "idle" | "loading" | "playing" | "paused" | "ending" | "returning" | "error";

/** 800ms spin decay + the storyboard's 300ms hold before the slide home. */
const END_HOLD_MS = 1100;
const HOME_SLIDE_MS = 400;
const SPINNER_DELAY_MS = 1500;
const LOAD_TIMEOUT_MS = 10000;

export function VinylCard() {
  const reduced = useReducedMotion();
  const titleId = useId();

  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const [timeLabel, setTimeLabel] = useState<string>(VINYL_TRACK.durationLabel);
  const lastLabelRef = useRef<string>(VINYL_TRACK.durationLabel);
  const [showSpinner, setShowSpinner] = useState(false);
  const [homeSlide, setHomeSlide] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<SVGCircleElement | null>(null);
  const spinRef = useRef<VinylSpin | null>(null);
  const playerRef = useRef<YouTubeHandle | null>(null);
  const playerPromiseRef = useRef<Promise<YouTubeHandle | null> | null>(null);
  const playTokenRef = useRef(0);
  const durationRef = useRef<number>(VINYL_TRACK.durationSeconds);
  const lastTimeRef = useRef(0);
  const hasReadyRef = useRef(false);
  const warmAttemptedRef = useRef(false);

  const endingTimerRef = useRef(0);
  const homeTimerRef = useRef(0);
  const errorTimerRef = useRef(0);

  const setProgress = useCallback((fraction: number) => {
    const circle = progressRef.current;

    if (!circle) return;

    const clamped = Math.max(0, Math.min(1, fraction));

    circle.style.strokeDashoffset = String(100 - clamped * 100);
  }, []);

  const clearReturnTimers = useCallback(() => {
    window.clearTimeout(endingTimerRef.current);
    window.clearTimeout(homeTimerRef.current);
    window.clearTimeout(errorTimerRef.current);
    endingTimerRef.current = 0;
    homeTimerRef.current = 0;
    errorTimerRef.current = 0;
  }, []);

  const syncTime = useCallback(() => {
    const player = playerRef.current;

    if (!player) return;

    try {
      const current = player.currentTime();

      lastTimeRef.current = current;

      const label = formatTime(current);

      if (label !== lastLabelRef.current) {
        lastLabelRef.current = label;
        setTimeLabel(label);
      }

      setProgress(current / Math.max(1, durationRef.current));
    } catch {
      // The player can stop answering between a tick and this read.
    }
  }, [setProgress]);

  const fail = useCallback(() => {
    const current = phaseRef.current;

    // A warm player can error while it is only cued. That is not a failed
    // play yet; the click will create a fresh one and surface the link then.
    if (current === "idle" || current === "error") return;

    playTokenRef.current += 1;
    clearReturnTimers();
    setShowSpinner(false);

    try {
      playerRef.current?.pause();
    } catch {
      // The player is already torn down.
    }

    spinRef.current?.pause();
    setPhase("error");
    lastTimeRef.current = 0;

    const label = formatTime(durationRef.current);

    lastLabelRef.current = label;
    setTimeLabel(label);
    setProgress(0);
    setHomeSlide(true);
    errorTimerRef.current = window.setTimeout(
      () => setHomeSlide(false),
      HOME_SLIDE_MS + 20,
    );
  }, [clearReturnTimers, setPhase, setProgress]);

  const handleEnded = useCallback(() => {
    const current = phaseRef.current;

    if (
      current === "idle" ||
      current === "error" ||
      current === "ending" ||
      current === "returning"
    ) {
      return;
    }

    clearReturnTimers();
    setShowSpinner(false);
    setPhase("ending");
    lastTimeRef.current = durationRef.current;

    const label = formatTime(durationRef.current);

    lastLabelRef.current = label;
    setTimeLabel(label);
    setProgress(1);

    endingTimerRef.current = window.setTimeout(() => {
      setPhase("returning");
      setHomeSlide(true);
      homeTimerRef.current = window.setTimeout(() => {
        setHomeSlide(false);
        setPhase("idle");
      }, HOME_SLIDE_MS);
    }, END_HOLD_MS);
  }, [clearReturnTimers, setPhase, setProgress]);

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
          createYouTubePlayer(host, VINYL_TRACK.videoId, {
            onReady: (handle, _state, duration) => {
              const firstReady = !hasReadyRef.current;

              hasReadyRef.current = true;
              playerRef.current = handle;

              if (duration > 0) durationRef.current = duration;

              // The embed is audio-only: keep it out of the tab order and the
              // accessibility tree even though it is also off-screen.
              const iframe = host.querySelector("iframe");

              if (iframe) {
                iframe.tabIndex = -1;
                iframe.setAttribute("aria-hidden", "true");
              }

              if (firstReady) {
                if (duration > 0) {
                  try {
                    const current = phaseRef.current;

                    if (current === "idle" || current === "error") {
                      const label = formatTime(duration);

                      lastLabelRef.current = label;
                      setTimeLabel(label);
                    }
                  } catch {
                    // Current time is unavailable until the player is ready.
                  }
                }

                settle(handle);
                return;
              }

              /*
               * The iframe re-initialises when its route has been hidden by
               * Activity (YouTube fires ready again with the playhead at 0).
               * That is not a fresh track: restore the frozen position instead
               * of overwriting the paused elapsed time with the duration.
               */
              const live = phaseRef.current;
              const resumeAt = lastTimeRef.current;

              try {
                if (live === "playing" || live === "loading") {
                  handle.seek(resumeAt);
                  handle.play();
                } else if (
                  live === "paused" ||
                  live === "ending" ||
                  live === "returning"
                ) {
                  handle.seek(resumeAt);
                  handle.pause();
                } else if (duration > 0) {
                  const label = formatTime(duration);

                  lastLabelRef.current = label;
                  setTimeLabel(label);
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
                  // A stale play request must never win over a pause, a cancel
                  // mid-slide, or a return to rest.
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

                if (duration > 0) durationRef.current = duration;
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
    clearReturnTimers();
    setHomeSlide(false);
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
    lastTimeRef.current = 0;
    lastLabelRef.current = "0:00";
    setTimeLabel("0:00");
    setProgress(0);

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
  }, [clearReturnTimers, ensurePlayer, fail, setPhase, setProgress]);

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
    clearReturnTimers();

    try {
      playerRef.current?.pause();
      playerRef.current?.seek(0);
    } catch {
      // The player never became ready.
    }

    setShowSpinner(false);
    lastTimeRef.current = 0;

    const label = formatTime(durationRef.current);

    lastLabelRef.current = label;
    setTimeLabel(label);
    setProgress(0);
    setPhase("returning");
    setHomeSlide(true);
    homeTimerRef.current = window.setTimeout(() => {
      setHomeSlide(false);
      setPhase("idle");
    }, HOME_SLIDE_MS);
  }, [clearReturnTimers, setPhase, setProgress]);

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

  // One spin for the element's life. Activity cleans effects on hide, so
  // returning a disposer here would recreate the animation and reset the angle
  // every time the route is revealed.
  useEffect(() => {
    const disc = discRef.current;

    if (!disc || spinRef.current) return;

    spinRef.current = createVinylSpin(disc);
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

      spinRef.current?.stop();

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

        spinRef.current?.stop();

        const current = phaseRef.current;

        if (current === "playing" || current === "loading") {
          setShowSpinner(false);
          setPhase("paused");
        }
      }
    }, 750);

    return () => window.clearInterval(id);
  }, [phase, setPhase]);

  const prevPhaseRef = useRef<Phase>("idle");
  const wasReducedRef = useRef(reduced);

  // Play ramps 600ms, resume 400ms from wherever the angle is, pause and track
  // end coast to 0 over 800ms. Nothing here restarts the rotation.
  useEffect(() => {
    const spin = spinRef.current;

    if (!spin) return;

    const previous = prevPhaseRef.current;

    if (reduced) {
      spin.stop();
    } else if (wasReducedRef.current && phase === "playing") {
      spin.start(true);
    } else if (phase === "loading") {
      spin.start(false);
    } else if (phase === "playing" && previous === "paused") {
      spin.start(true);
    } else if (
      phase === "paused" ||
      phase === "ending" ||
      phase === "returning" ||
      phase === "error"
    ) {
      spin.pause();
    } else if (phase === "idle") {
      spin.reset();
    }

    prevPhaseRef.current = phase;
    wasReducedRef.current = reduced;
  }, [phase, reduced]);

  // Elapsed time in tabular numbers, at most one text update per second. The
  // spin is a WAAPI animation outside React, so these renders cannot hitch it.
  useEffect(() => {
    if (phase !== "playing") return;

    const update = () => {
      const player = playerRef.current;

      if (!player) return;

      try {
        const current = player.currentTime();
        const label = formatTime(current);

        lastTimeRef.current = current;

        if (label !== lastLabelRef.current) {
          lastLabelRef.current = label;
          setTimeLabel(label);
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

  const isOut =
    phase === "loading" ||
    phase === "playing" ||
    phase === "paused" ||
    phase === "ending";
  const playing = phase === "playing" || phase === "loading";
  const spinnerVisible = showSpinner && phase === "loading";

  const status =
    phase === "loading"
      ? `Loading ${VINYL_TRACK.title}`
      : phase === "playing"
        ? `Playing ${VINYL_TRACK.title}`
        : phase === "paused"
          ? `Paused ${VINYL_TRACK.title}`
          : phase === "ending" || phase === "returning"
            ? "Track ended"
            : phase === "error"
              ? "Playback unavailable"
              : "";

  return (
    <div
      ref={cardRef}
      role="group"
      aria-labelledby={titleId}
      data-position={isOut ? "out" : "rest"}
      data-return={homeSlide ? "true" : undefined}
      data-phase={phase}
      onPointerEnter={warmPlayer}
      onFocus={warmPlayer}
      onPointerDown={warmPlayer}
      className="ring-host vinyl-card flex h-40 w-40 flex-col rounded-lg pt-[22px] pb-[22px] md:size-[220px] md:pt-[26px] xl:h-[276px] xl:w-[275px]"
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="vinyl-body">
        <div className="vinyl-art" aria-hidden="true">
          <div className="vinyl-disc-shell">
            <div ref={discRef} className="vinyl-disc">
              <span className="vinyl-groove vinyl-groove-wide" />
              <span className="vinyl-groove vinyl-groove-inner" />
              <span className="vinyl-label">
                <span className="vinyl-label-hole" />
                <span className="vinyl-label-tick" />
              </span>
            </div>

            <svg
              className="vinyl-progress"
              viewBox="0 0 124 124"
              aria-hidden="true"
            >
              <g transform="rotate(-90 62 62)">
                <circle
                  ref={progressRef}
                  className="vinyl-progress-circle"
                  cx="62"
                  cy="62"
                  r="61"
                  pathLength={100}
                  fill="none"
                  strokeWidth="2"
                />
              </g>
            </svg>
          </div>

          <div className="vinyl-sleeve">
            <div className="vinyl-artwork" />
            {imgFailed ? null : (
              <Image
                src={thumbnailUrl(VINYL_TRACK.videoId)}
                alt=""
                fill
                priority
                sizes="(min-width: 1280px) 118px, (min-width: 768px) 94px, 62px"
                className="vinyl-sleeve-image"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
        </div>

        <div className="vinyl-meta">
          <p id={titleId} className="vinyl-title">
            {VINYL_TRACK.title}
          </p>
          <p className="vinyl-subtitle">{VINYL_TRACK.subtitle}</p>
        </div>

        <div className="vinyl-footer">
          {phase === "error" ? (
            <a
              className="vinyl-link"
              href={watchUrl(VINYL_TRACK.videoId)}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="vinyl-time" aria-hidden="true">
              {timeLabel}
            </span>
          )}

          <button
            type="button"
            className="vinyl-button"
            aria-label={playing ? "Pause" : `Play ${VINYL_TRACK.title}`}
            onClick={toggle}
          >
            <span
              className="vinyl-icon"
              data-visible={!playing && !spinnerVisible ? "true" : "false"}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 13 13"
                aria-hidden="true"
              >
                <path d="M3.8 2.2L11 6.5L3.8 10.8V2.2Z" fill="currentColor" />
              </svg>
            </span>
            <span
              className="vinyl-icon"
              data-visible={playing && !spinnerVisible ? "true" : "false"}
            >
              <svg
                width="10"
                height="11"
                viewBox="0 0 12 13"
                aria-hidden="true"
              >
                <rect
                  x="1"
                  y="1"
                  width="3"
                  height="11"
                  rx="1"
                  fill="currentColor"
                />
                <rect
                  x="8"
                  y="1"
                  width="3"
                  height="11"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            </span>
            {spinnerVisible ? (
              <span className="vinyl-icon vinyl-spinner" data-visible="true">
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

      <div ref={hostRef} className="vinyl-player-host" aria-hidden="true" />
    </div>
  );
}
