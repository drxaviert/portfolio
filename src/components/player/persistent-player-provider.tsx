"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { playerStore } from "./player-store";
import "./player.css";

/**
 * Mounted once in the root layout, above every route. Navigation changes the
 * children but never this provider, so the hidden iframe and the store survive
 * / ↔ /work ↔ /work/[slug].
 *
 * The host is empty until a player control warms the store; page load never
 * creates the YouTube iframe.
 */
export function PersistentPlayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    playerStore.attachHost(hostRef.current);

    return () => playerStore.attachHost(null);
  }, []);

  return (
    <>
      {children}
      <div ref={hostRef} className="player-host" aria-hidden="true" />
    </>
  );
}
