/**
 * The three hover treatments compared on /dev/human-contact.
 *
 * The URL is the source of truth: `?variant=a|b|c` selects a treatment on
 * first load, and the corner toggle rewrites the query without navigating, so
 * a variant can be linked to or reloaded. A tiny external store lets React
 * read that URL during hydration without a mismatch (the server always
 * renders A), and without setting state from an effect.
 */
import { useSyncExternalStore } from "react";

export const HOVER_VARIANTS = [
  { id: "a", label: "Scale" },
  { id: "b", label: "Lift" },
  { id: "c", label: "Make room" },
] as const;

export type HoverVariant = (typeof HOVER_VARIANTS)[number]["id"];

const VARIANT_EVENT = "hc-variant-change";

export function isHoverVariant(value: string | null): value is HoverVariant {
  return value === "a" || value === "b" || value === "c";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(VARIANT_EVENT, onChange);

  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(VARIANT_EVENT, onChange);
  };
}

function getSnapshot(): HoverVariant {
  const value = new URLSearchParams(window.location.search).get("variant");

  return isHoverVariant(value) ? value : "a";
}

function getServerSnapshot(): HoverVariant {
  return "a";
}

export function useHoverVariant(): HoverVariant {
  // React reads the server snapshot while hydrating, then the live URL, so a
  // `?variant=b` load settles on B without hydration warnings.
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function selectHoverVariant(variant: HoverVariant): void {
  const url = new URL(window.location.href);

  url.searchParams.set("variant", variant);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(VARIANT_EVENT));
}
