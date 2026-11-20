/**
 * Whether the visitor is moving through the page by keyboard, for focus that
 * script moves on their behalf (the drawer's return to its trigger). WebKit
 * paints `:focus-visible` on every scripted focus, so the caller says
 * explicitly whether the ring belongs.
 *
 * Only keys that move or activate focus count. Esc and modifiers do not: a
 * mouse user closing the drawer with Esc is still a mouse user. A pointer
 * press hands the page back to the pointer.
 *
 * Installed at import, from the nav (always mounted), so the key that opens the
 * drawer is seen before the drawer's own code has loaded.
 */
const NAVIGATION_KEYS = new Set([
  "Tab",
  "Enter",
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

let keyboard = false;

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (NAVIGATION_KEYS.has(event.key)) keyboard = true;
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    () => {
      keyboard = false;
    },
    true,
  );
}

export function navigatingByKeyboard(): boolean {
  return keyboard;
}
