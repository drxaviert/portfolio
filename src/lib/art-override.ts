import type { FrameEra } from "@/components/home/art-card/frame-style";
import type { Phase } from "@/lib/theme";

/**
 * The dev-only homepage override, parsed from the query string.
 *
 * Kept as a pure function so the client wrapper stays small and the URL
 * contract is testable: unknown eras and phases are ignored, and `art` must be
 * a positive AIC id. Production never calls this; the wrapper returns before
 * reading the URL.
 */

const ERAS: readonly FrameEra[] = [
  "gilt-ornate",
  "gilt-carved",
  "walnut",
  "modern",
  "scroll",
];

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

/** The dev panel writes the URL; listeners re-read the same override. */
export const ART_OVERRIDE_EVENT = "art-override-change";

export type ArtOverride = {
  artId: number | null;
  era: FrameEra | null;
  phase: Phase | null;
  /** TEMPORARY pf-ut4 comparison: the pre-merge frame treatment. */
  frames: boolean;
};

export function parseArtOverride(search: string): ArtOverride {
  const params = new URLSearchParams(search);
  const eraParam = params.get("era");
  const phaseParam = params.get("phase");
  const artParam = params.get("art");
  const era = ERAS.find((value) => value === eraParam) ?? null;
  const phase = PHASES.find((value) => value === phaseParam) ?? null;
  const artId =
    artParam && /^\d{1,9}$/.test(artParam) ? Number(artParam) : null;

  return {
    artId: artId !== null && artId > 0 ? artId : null,
    era,
    phase,
    frames: params.get("frames") === "current",
  };
}

/**
 * Writes the override back to the query so the panel's state is shareable and
 * survives a refresh. Auto/new/today are the absence of their param. The
 * custom event makes the URL the live source of truth without a reload; other
 * query keys are preserved.
 */
export function writeArtOverride(values: ArtOverride): void {
  const url = new URL(window.location.href);

  if (values.artId === null) url.searchParams.delete("art");
  else url.searchParams.set("art", String(values.artId));

  if (values.era === null) url.searchParams.delete("era");
  else url.searchParams.set("era", values.era);

  if (values.phase === null) url.searchParams.delete("phase");
  else url.searchParams.set("phase", values.phase);

  if (values.frames) url.searchParams.set("frames", "current");
  else url.searchParams.delete("frames");

  window.history.replaceState(window.history.state, "", url.toString());
  window.dispatchEvent(new Event(ART_OVERRIDE_EVENT));
}
