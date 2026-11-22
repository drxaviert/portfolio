/**
 * The prototype switch for the reader's "← Work" hover menu.
 *
 * `?bm=dropdown|inline|crumb|side` wins on load, then localStorage remembers the
 * last choice. Everything is try/catch: a private window or a blocked storage
 * API falls back to the dropdown, and the prototype still works.
 */

export const BACK_MENU_VARIANTS = [
  "dropdown",
  "inline",
  "crumb",
  "side",
] as const;

export type BackMenuVariant = (typeof BACK_MENU_VARIANTS)[number];

export const BACK_MENU_STORAGE_KEY = "portfolio.back-menu";

/** Same-tab notification; `storage` only fires in other tabs. */
export const BACK_MENU_EVENT = "back-menu-variant";

export function isBackMenuVariant(value: unknown): value is BackMenuVariant {
  return (
    typeof value === "string" &&
    (BACK_MENU_VARIANTS as readonly string[]).includes(value)
  );
}

export function readStoredBackMenuVariant(): BackMenuVariant | null {
  try {
    const value = window.localStorage.getItem(BACK_MENU_STORAGE_KEY);

    return isBackMenuVariant(value) ? value : null;
  } catch {
    return null;
  }
}

export function readBackMenuVariantFromSearch(
  search: string,
): BackMenuVariant | null {
  const value = new URLSearchParams(search).get("bm");

  return isBackMenuVariant(value) ? value : null;
}

/** URL first, then the remembered choice, then the requested default. */
export function initialBackMenuVariant(): BackMenuVariant {
  if (typeof window === "undefined") return "dropdown";

  return (
    readBackMenuVariantFromSearch(window.location.search) ??
    readStoredBackMenuVariant() ??
    "dropdown"
  );
}

/** The snapshot `useSyncExternalStore` reads; a string is referentially stable. */
export function currentBackMenuVariant(): BackMenuVariant {
  return initialBackMenuVariant();
}

/** Dev shows the pill always; production only when a review URL asked for it. */
export function backMenuSwitchVisible(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;

  return readBackMenuVariantFromSearch(window.location.search) !== null;
}

export function storeBackMenuVariant(variant: BackMenuVariant): void {
  try {
    window.localStorage.setItem(BACK_MENU_STORAGE_KEY, variant);
  } catch {
    // The prototype still switches for this page; it just will not remember.
  }
}

/** Keep `?bm=` in the address bar so the variant can be shared or reloaded. */
function writeVariantToUrl(variant: BackMenuVariant): void {
  try {
    const url = new URL(window.location.href);

    if (url.searchParams.get("bm") === variant) return;

    url.searchParams.set("bm", variant);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // A replaceState failure (a sandboxed frame) is not worth breaking a click.
  }
}

export function setBackMenuVariant(
  variant: BackMenuVariant,
  options: { url?: boolean } = {},
): void {
  storeBackMenuVariant(variant);

  if (options.url !== false) writeVariantToUrl(variant);

  window.dispatchEvent(
    new CustomEvent<BackMenuVariant>(BACK_MENU_EVENT, { detail: variant }),
  );
}

/** Follow the pill and other tabs. Returns the unsubscribe. */
export function subscribeBackMenuVariant(
  listener: (variant: BackMenuVariant) => void,
): () => void {
  function onVariant(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    if (isBackMenuVariant(event.detail)) listener(event.detail);
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== BACK_MENU_STORAGE_KEY) return;
    if (isBackMenuVariant(event.newValue)) listener(event.newValue);
  }

  window.addEventListener(BACK_MENU_EVENT, onVariant);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(BACK_MENU_EVENT, onVariant);
    window.removeEventListener("storage", onStorage);
  };
}
