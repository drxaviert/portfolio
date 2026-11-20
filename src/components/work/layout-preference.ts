/**
 * The index layout the visitor chose. localStorage, not the URL: it is their
 * preference, it should survive leaving the drawer, and it must not need a
 * router navigation to change.
 *
 * The `<html>` attribute is the rendered source of truth: the inline bootstrap
 * script in the work layout sets it before paint on a hard load, and the
 * component keeps it in step after that. The external store below lets the
 * control hydrate from the server's default and settle on the attribute without
 * a hydration mismatch.
 */
export type WorkLayout = "grid" | "list";

export const LAYOUT_STORAGE_KEY = "wd-work-layout";
export const LAYOUT_ATTRIBUTE = "data-work-layout";

/**
 * The stored layout, or grid when nothing (or nothing readable) is there.
 * Every storage access is guarded: private mode, a full store and a blocked
 * origin all throw, and a preference is never worth a broken page.
 */
export function readStoredLayout(): WorkLayout {
  try {
    return window.localStorage?.getItem(LAYOUT_STORAGE_KEY) === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
}

export function storeLayout(layout: WorkLayout): void {
  try {
    window.localStorage?.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // The in-memory choice still holds for this page.
  }
}

export function applyLayoutAttribute(layout: WorkLayout): void {
  document.documentElement.setAttribute(LAYOUT_ATTRIBUTE, layout);
}

const listeners = new Set<() => void>();

/**
 * What is on screen: the attribute the stylesheet reads, or the stored choice
 * while a client navigation has not applied it yet. Stable between calls, which
 * `useSyncExternalStore` requires.
 */
export function getLayoutSnapshot(): WorkLayout {
  const attribute = document.documentElement.getAttribute(LAYOUT_ATTRIBUTE);

  if (attribute === "grid" || attribute === "list") return attribute;

  return readStoredLayout();
}

/** The server cannot know the visitor's storage: it renders the grid. */
export function getLayoutServerSnapshot(): WorkLayout {
  return "grid";
}

export function subscribeToLayout(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Apply, remember and announce the visitor's choice. */
export function chooseLayout(layout: WorkLayout): void {
  applyLayoutAttribute(layout);
  storeLayout(layout);

  for (const listener of listeners) listener();
}
