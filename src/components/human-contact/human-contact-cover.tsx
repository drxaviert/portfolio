"use client";

import type { ComponentType } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { hasWebGLSupport, isSafari } from "./environment";
import { HumanContactStill } from "./human-contact-still";
import "./human-contact.css";

type HumanContactSceneComponent = ComponentType<{
  onFallback?: () => void;
  onReady?: () => void;
  onTeardown?: () => void;
}>;

/** How close the card has to be before the scene chunk is asked for. */
const NEAR_MARGIN = "240px 0px";

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function subscribe() {
  return () => {};
}

let liveCapability: boolean | null = null;

/** Safari and a browser without WebGL never start a loop; they keep the still. */
function getLiveCapability(): boolean {
  if (typeof navigator === "undefined") return false;

  if (liveCapability === null) {
    liveCapability = !isSafari() && hasWebGLSupport();
  }

  return liveCapability;
}

function getServerLiveCapability(): boolean {
  return false;
}

/**
 * The Human Contact cover: the captured still is the first paint and the
 * permanent floor, and the live scene crossfades over it only after its first
 * frame. The scene chunk is asked for when the cover is near the viewport and
 * the browser is idle, so three.js never joins the home page's initial JS.
 *
 * `live` is false for the idle /work hover thumbnail: the still carries it
 * until the row is hovered, then the scene mounts with the thumbnail.
 */
export function HumanContactCover({ live = true }: { live?: boolean }) {
  // Reduced motion keeps the still: no chunk, no context, no frame. The scene
  // also holds a single frame when the preference flips after it started.
  const reduced = useReducedMotion();

  return (
    <div className="hc-project-cover" aria-hidden="true">
      <HumanContactStill />
      {live && !reduced ? <HumanContactLive /> : null}
    </div>
  );
}

function HumanContactLive() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [Scene, setScene] = useState<HumanContactSceneComponent | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const capable = useSyncExternalStore(
    subscribe,
    getLiveCapability,
    getServerLiveCapability,
  );

  useEffect(() => {
    if (!capable) return;

    const host = hostRef.current;

    if (!host || typeof IntersectionObserver === "undefined") return;

    let idle: number | null = null;
    let timer: number | null = null;
    let alive = true;

    const idleWindow = window as IdleWindow;

    const mount = () => {
      idle = null;
      timer = null;

      if (!alive) return;

      // A plain import in the idle callback, not `next/dynamic`: the router
      // preloads every dynamic entry reachable from a client module, which put
      // this chunk in every study's first load. The scene is only fetched when
      // this cover is actually near the viewport.
      import("./human-contact-scene")
        .then((module) => {
          if (alive) setScene(() => module.HumanContactScene);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });

      setMounted(true);
    };

    const schedule = () => {
      if (idle !== null || timer !== null) return;

      if (typeof idleWindow.requestIdleCallback === "function") {
        idle = idleWindow.requestIdleCallback(mount, { timeout: 2000 });
      } else {
        // Safari has no requestIdleCallback; one turn of the event loop keeps
        // the chunk off the first-paint critical path.
        timer = window.setTimeout(mount, 200);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        observer.disconnect();
        schedule();
      },
      { rootMargin: NEAR_MARGIN },
    );

    observer.observe(host);

    return () => {
      alive = false;
      observer.disconnect();

      if (idle !== null) idleWindow.cancelIdleCallback?.(idle);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [capable]);

  const showScene = capable && !failed && mounted && Scene !== null;

  return (
    <div
      ref={hostRef}
      className="hc-cover-scene"
      data-live={ready ? "" : undefined}
    >
      {showScene ? (
        <Scene
          onReady={() => setReady(true)}
          onTeardown={() => setReady(false)}
          onFallback={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
