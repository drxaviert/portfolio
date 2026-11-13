/**
 * Dev-only hover-motion variants for the segmented theme controls.
 *
 * 0 is the shipped look. 1-4 combine a follow pill with icon character
 * motion; the choice is remembered locally and applied as
 * `data-hover-variant` on <html> so CSS can switch the same rules for the
 * toggle and the Day-phase row.
 */
export const HOVER_VARIANT_STORAGE_KEY = "theme-hover-variant";

export const HOVER_VARIANTS = [
  { value: 0, label: "0 · Current" },
  { value: 1, label: "1 · Classic" },
  { value: 2, label: "2 · Springy" },
  { value: 3, label: "3 · Quiet" },
  { value: 4, label: "4 · Stretch + sequence" },
] as const;

export type HoverVariant = (typeof HOVER_VARIANTS)[number]["value"];

/** Accepts 0-4 from storage or the select; anything else falls back to 0. */
export function parseHoverVariant(value: unknown): HoverVariant {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 4
    ? (parsed as HoverVariant)
    : 0;
}

/** Reads the remembered variant; blocked storage means the current look. */
export function readHoverVariant(): HoverVariant {
  try {
    return parseHoverVariant(
      window.localStorage.getItem(HOVER_VARIANT_STORAGE_KEY),
    );
  } catch {
    return 0;
  }
}

/** Persists the variant; a failed write must not break the page. */
export function writeHoverVariant(variant: HoverVariant): void {
  try {
    window.localStorage.setItem(HOVER_VARIANT_STORAGE_KEY, String(variant));
  } catch {
    // Intentionally ignored: the current page keeps the chosen variant.
  }
}

/** The variant applied to <html>, for interaction handlers. */
export function appliedHoverVariant(): HoverVariant {
  return parseHoverVariant(document.documentElement.dataset.hoverVariant);
}
