"use client";

import { useSyncExternalStore } from "react";
import { playerStore } from "./player-store";
import type { PlayerStore } from "./player-store";

/** The full snapshot, including the 250ms time tick. */
export function usePlayer(store: PlayerStore = playerStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** Status and duration only: no re-render on time ticks. */
export function usePlayerStatus(store: PlayerStore = playerStore) {
  return useSyncExternalStore(
    store.subscribeStatus,
    store.getStatusSnapshot,
    store.getServerStatusSnapshot,
  );
}
