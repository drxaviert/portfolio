"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DailyArt } from "@/lib/daily-art";
import {
  ART_OVERRIDE_EVENT,
  parseArtOverride,
  writeArtOverride,
} from "@/lib/art-override";
import { pinPhase, unpinPhase } from "@/lib/theme";
import { ArtCard } from "./art-card";
import { HomeArtControls } from "./home-art-controls";

/**
 * The home card plus the dev-only `?art` / `?era` / `?phase` test hook.
 *
 * `page.tsx` imports this module only when NODE_ENV=development, so the
 * floating panel and this whole file stay out of the production client graph.
 * The URL is the single source of truth: the panel writes it, the store reads
 * it, and the card/phase follow without a reload. The existing theme toggle
 * still switches the phase; `?phase=` is only a linkable starting point.
 *
 * The URL is an external store (`useSyncExternalStore`) so the server can
 * render a stable card and the client can adopt the query without a
 * setState-in-effect cascade. `?era=scroll` also forces the hanging mount,
 * because the scroll styling is a mount, not just an era.
 *
 * TEMPORARY pf-ut4: `?frames=current` marks the frame for the origin/main
 * treatment in painting-frame-current.css. Remove the flag, that CSS file and
 * the frames props before merging.
 */

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(ART_OVERRIDE_EVENT, onChange);

  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(ART_OVERRIDE_EVENT, onChange);
  };
}

function readLocationSearch() {
  return window.location.search;
}

function readServerSearch() {
  return "";
}

export function HomeArtCardDev({ art }: { art: DailyArt }) {
  const search = useSyncExternalStore(
    subscribeToLocation,
    readLocationSearch,
    readServerSearch,
  );
  const override = parseArtOverride(search);
  const { artId, era, phase, frames } = override;
  const [fetched, setFetched] = useState<{
    artId: number;
    art: DailyArt;
  } | null>(null);

  useEffect(() => {
    if (!phase) return;

    pinPhase(phase);

    return () => unpinPhase();
  }, [phase]);

  useEffect(() => {
    if (artId === null) return;

    const controller = new AbortController();
    let cancelled = false;

    fetch(`/api/dev/art/${artId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json() as Promise<DailyArt>;
      })
      .then((next) => {
        if (!cancelled) setFetched({ artId, art: next });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn(`[art-override] could not load AIC ${artId}:`, error);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [artId]);

  const current =
    artId !== null && fetched?.artId === artId ? fetched.art : art;

  return (
    <>
      <ArtCard
        art={current}
        era={era ?? undefined}
        mount={era === "scroll" ? "hanging" : undefined}
        frames={frames ? "current" : undefined}
      />
      <HomeArtControls override={override} onChange={writeArtOverride} />
    </>
  );
}
