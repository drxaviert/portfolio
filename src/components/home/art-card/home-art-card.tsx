"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DailyArt } from "@/lib/daily-art";
import { parseArtOverride } from "@/lib/art-override";
import { pinPhase, unpinPhase } from "@/lib/theme";
import { ArtCard } from "./art-card";

/**
 * The home card plus the dev-only `?art` / `?era` / `?phase` test hook.
 *
 * `/` stays server-rendered and static: the dev branch renders the cached
 * daily artwork first and only reads the URL after hydration. Production
 * returns `<ArtCard>` directly, so the cached pick and the static route are
 * untouched. The existing theme toggle still switches the phase; `?phase=` is
 * only a linkable starting point for a review.
 *
 * The URL is an external store (`useSyncExternalStore`) so the server can
 * render a stable card and the client can adopt the query without a
 * setState-in-effect cascade. `?era=scroll` also forces the hanging mount,
 * because the scroll styling is a mount, not just an era.
 */

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);

  return () => window.removeEventListener("popstate", onChange);
}

function readLocationSearch() {
  return window.location.search;
}

function readServerSearch() {
  return "";
}

export function HomeArtCard({ art }: { art: DailyArt }) {
  if (process.env.NODE_ENV === "production") return <ArtCard art={art} />;

  return <DevArtCard art={art} />;
}

function DevArtCard({ art }: { art: DailyArt }) {
  const search = useSyncExternalStore(
    subscribeToLocation,
    readLocationSearch,
    readServerSearch,
  );
  const { artId, era, phase } = parseArtOverride(search);
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
    <ArtCard
      art={current}
      era={era ?? undefined}
      mount={era === "scroll" ? "hanging" : undefined}
    />
  );
}
