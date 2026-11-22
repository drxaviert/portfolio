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

/*
 * The one in-memory source of truth. Reading the URL and localStorage in
 * `getSnapshot` looked equivalent, but it left a mounted reader on the URL's
 * old `?bm=` whenever replaceState did not land (a blocked write, a sandboxed
 * frame, or another tab's stale URL): the pill had changed the memory, yet the
 * snapshot still answered with the old query. Every BackLink now subscribes to
 * this module store, so the visible tree updates even when persistence does
 * not.
 */
let currentVariant: BackMenuVariant | null = null;
const listeners = new Set<() => void>();
let globalsBound = false;

function notify() {
  for (const listener of listeners) listener();
}

function applyVariant(next: BackMenuVariant) {
  if (currentVariant === next) return;

  currentVariant = next;
  notify();
}

/** One set of window listeners per module instance, however many readers. */
function bindGlobalListeners() {
  if (globalsBound || typeof window === "undefined") return;

  globalsBound = true;

  window.addEventListener(BACK_MENU_EVENT, (event) => {
    if (event instanceof CustomEvent && isBackMenuVariant(event.detail)) {
      applyVariant(event.detail);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== BACK_MENU_STORAGE_KEY) return;
    if (isBackMenuVariant(event.newValue)) applyVariant(event.newValue);
  });

  // Back/Forward may restore a URL with a different `?bm=`.
  window.addEventListener("popstate", () => {
    applyVariant(initialBackMenuVariant());
  });
}

/** The snapshot `useSyncExternalStore` reads; a string is referentially stable. */
export function currentBackMenuVariant(): BackMenuVariant {
  if (typeof window === "undefined") return "dropdown";

  if (currentVariant === null) currentVariant = initialBackMenuVariant();

  return currentVariant;
}

/** Re-read the environment (history traversal; tests resetting the store). */
export function syncBackMenuVariantFromEnvironment(): BackMenuVariant {
  const next = initialBackMenuVariant();

  applyVariant(next);

  return next;
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
    // The store still switches this page; it just will not remember.
  }
}

/** Keep `?bm=` in the address bar so the variant can be shared or reloaded. */
function writeVariantToUrl(variant: BackMenuVariant): void {
  try {
    const url = new URL(window.location.href);

    if (url.searchParams.get("bm") === variant) return;

    url.searchParams.set("bm", variant);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // A replaceState failure (a sandboxed frame) must not break the switch:
    // the module store already has the new variant and will notify React.
  }
}

export function setBackMenuVariant(
  variant: BackMenuVariant,
  options: { url?: boolean } = {},
): void {
  // Memory first: the click is the source of truth for this page from here on.
  currentVariant = variant;
  storeBackMenuVariant(variant);

  if (options.url !== false) writeVariantToUrl(variant);

  notify();

  // Other copies of this module (layout and reader can land in different
  // chunks) follow the same window event; this copy sees it as a no-op.
  window.dispatchEvent(
    new CustomEvent<BackMenuVariant>(BACK_MENU_EVENT, { detail: variant }),
  );
}

/** Subscribe a React tree to the store. Returns the unsubscribe. */
export function subscribeBackMenuVariant(listener: () => void): () => void {
  bindGlobalListeners();
  listeners.add(listener);

  if (currentVariant === null) currentVariant = initialBackMenuVariant();

  return () => {
    listeners.delete(listener);
  };
}
