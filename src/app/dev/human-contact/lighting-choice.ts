"use client";

import { useSyncExternalStore } from "react";
import type { LightingPreset } from "@/components/human-contact/lighting";

/**
 * The dev route's lighting choice. The URL is the source of truth, so
 * `?light=1|2|3` is shareable and the toggle rewrites it in place. The server
 * always renders preset 1; the client corrects after hydration without a
 * mismatch.
 */
export type LightingChoice = "1" | "2" | "3";

export const LIGHTING_CHOICES = [
  { id: "1", label: "Key + rim", preset: "key-rim" },
  { id: "2", label: "Spotlight", preset: "spotlight" },
  { id: "3", label: "Film", preset: "film" },
] as const satisfies readonly {
  id: LightingChoice;
  label: string;
  preset: LightingPreset;
}[];

export function isLightingChoice(value: string | null): value is LightingChoice {
  return value === "1" || value === "2" || value === "3";
}

const LIGHTING_EVENT = "hc-light-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(LIGHTING_EVENT, onChange);

  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(LIGHTING_EVENT, onChange);
  };
}

function getSnapshot(): LightingChoice {
  const value = new URLSearchParams(window.location.search).get("light");

  return isLightingChoice(value) ? value : "1";
}

function getServerSnapshot(): LightingChoice {
  return "1";
}

export function useLightingChoice(): LightingChoice {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function selectLightingChoice(choice: LightingChoice): void {
  const url = new URL(window.location.href);

  url.searchParams.set("light", choice);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(LIGHTING_EVENT));
}
