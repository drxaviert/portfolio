/**
 * The close-placement prototype behind the index's way home.
 *
 * Dat is choosing where `/work`'s close belongs, so each candidate ships at
 * once: `?xv=<name>` picks one, the choice is remembered in localStorage, and a
 * dev-only switch in the page flips it live. The default is today's PR 97
 * placement, so a visitor who never touches the switch sees what shipped.
 *
 * The value is read in one place and shared through a tiny external store
 * (`useSyncExternalStore`): the drawer, the list and the nav all need it, and a
 * URL change made by the switch must reach all three without a reload.
 */

export const CLOSE_VARIANTS = [
  "below",
  "nav",
  "corner",
  "back",
  "pill",
] as const;

export type CloseVariant = (typeof CLOSE_VARIANTS)[number];

export const DEFAULT_CLOSE_VARIANT: CloseVariant = "below";
export const CLOSE_VARIANT_PARAM = "xv";
export const CLOSE_VARIANT_STORAGE_KEY = "work-close-variant";

export function parseCloseVariant(
  value: string | null | undefined,
): CloseVariant | null {
  return CLOSE_VARIANTS.find((variant) => variant === value) ?? null;
}

export function hasCloseVariantParam(search: string): boolean {
  return new URLSearchParams(search).has(CLOSE_VARIANT_PARAM);
}

export function readUrlCloseVariant(search: string): CloseVariant | null {
  return parseCloseVariant(
    new URLSearchParams(search).get(CLOSE_VARIANT_PARAM),
  );
}

export function readStoredCloseVariant(): CloseVariant | null {
  try {
    return parseCloseVariant(
      window.localStorage.getItem(CLOSE_VARIANT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function storeCloseVariant(variant: CloseVariant): void {
  try {
    window.localStorage.setItem(CLOSE_VARIANT_STORAGE_KEY, variant);
  } catch {
    // Private mode or blocked storage: the switch still works for this page.
  }
}

/** Put the chosen variant in the URL, so each comparison has one. */
function writeCloseVariantParam(variant: CloseVariant): void {
  const url = new URL(window.location.href);

  url.searchParams.set(CLOSE_VARIANT_PARAM, variant);
  window.history.replaceState(window.history.state, "", url);
}

function readInitial(): { variant: CloseVariant; pill: boolean } {
  if (typeof window === "undefined") {
    return { variant: DEFAULT_CLOSE_VARIANT, pill: false };
  }

  const fromUrl = readUrlCloseVariant(window.location.search);
  const variant = fromUrl ?? readStoredCloseVariant() ?? DEFAULT_CLOSE_VARIANT;

  // A URL that names a variant is also a saved choice: a later visit to
  // `/work` without the param keeps what Dat was looking at.
  if (fromUrl) storeCloseVariant(fromUrl);

  const pill =
    process.env.NODE_ENV !== "production" ||
    hasCloseVariantParam(window.location.search);

  return { variant, pill };
}

let current: CloseVariant = DEFAULT_CLOSE_VARIANT;
let showPill = false;
let ready = false;
const listeners = new Set<() => void>();

function initialize(): void {
  if (ready || typeof window === "undefined") return;

  ready = true;
  const initial = readInitial();

  current = initial.variant;
  showPill = initial.pill;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeCloseVariant(listener: () => void): () => void {
  initialize();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getCloseVariant(): CloseVariant {
  initialize();

  return current;
}

export function getServerCloseVariant(): CloseVariant {
  return DEFAULT_CLOSE_VARIANT;
}

export function setCloseVariant(variant: CloseVariant): void {
  initialize();

  if (variant === current) return;

  current = variant;
  storeCloseVariant(variant);
  writeCloseVariantParam(variant);
  emit();
}

/** The dev switch is always on in development, and on a `?xv=` link in prod. */
export function getShowCloseSwitch(): boolean {
  initialize();

  return showPill;
}

export function getServerShowCloseSwitch(): boolean {
  return false;
}

/** Test seam: forget the module-level read so the next test starts clean. */
export function resetCloseVariantForTests(): void {
  current = DEFAULT_CLOSE_VARIANT;
  showPill = false;
  ready = false;
  listeners.clear();
}
