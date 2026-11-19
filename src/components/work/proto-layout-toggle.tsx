"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Prototype only: the drawer ships one layout and one close behaviour once Dat
 * picks them. Until then the switcher reads `?layout=grid|list` (keys G / L)
 * and `?close=a|b` (keys A / B), so the two can be compared at any width and in
 * either phase.
 *
 * The stores are module-level so the URL, the keys and the controls all agree
 * without a router navigation: changing a prototype option is not a page load.
 */

export type ProtoLayout = "grid" | "list";
/** A: Esc and the backdrop close the drawer. B: they step back to the index. */
export type CloseBehaviour = "a" | "b";

function createParamStore<T extends string>(
  key: string,
  parse: (value: string | null) => T,
  fallback: T,
) {
  let current: T | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    const fromUrl = new URL(window.location.href).searchParams.get(key);

    if (fromUrl !== null) return parse(fromUrl);

    // A choice made in the drawer has to survive the next navigation, whose URL
    // does not carry this query string: keep it for the tab. Prototype-only, and
    // deleted with the rest of the switcher.
    try {
      return parse(window.sessionStorage?.getItem(`wd-proto-${key}`) ?? null);
    } catch {
      return fallback;
    }
  }

  const STORAGE = `wd-proto-${key}`;

  function remember(next: T) {
    try {
      window.sessionStorage?.setItem(STORAGE, next);
    } catch {
      // Private mode or a full store: the in-memory value still holds.
    }
  }

  // Read once, at module load on the client: a prototype option chosen on the
  // homepage has to survive the navigation into the drawer.
  if (typeof window !== "undefined") current = read();

  function getSnapshot(): T {
    current ??= read();

    return current;
  }

  /** The server cannot know the query string: it renders the default. */
  function getServerSnapshot(): T {
    return fallback;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("popstate", listener);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("popstate", listener);
    };
  }

  function set(next: T) {
    if (current === next) return;

    current = next;
    remember(next);

    const url = new URL(window.location.href);
    url.searchParams.set(key, next);
    window.history.replaceState(window.history.state, "", url);

    for (const listener of listeners) listener();
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
    set,
    get: () => current ?? read(),
  };
}

const layoutStore = createParamStore<ProtoLayout>(
  "layout",
  (value) => (value === "list" ? "list" : "grid"),
  "grid",
);

const closeStore = createParamStore<CloseBehaviour>(
  "close",
  (value) => (value === "b" ? "b" : "a"),
  "a",
);

export const setProtoLayout = layoutStore.set;
export const setCloseBehaviour = closeStore.set;
export const getCloseBehaviour = closeStore.get;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** The G / L and A / B keys, for whichever options the sheet is showing. */
function useProtoKeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      if (event.defaultPrevented || isTyping(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "g") layoutStore.set("grid");
      if (key === "l") layoutStore.set("list");
      if (key === "a") closeStore.set("a");
      if (key === "b") closeStore.set("b");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function useProtoLayout(): ProtoLayout {
  useProtoKeys();

  return useSyncExternalStore(
    layoutStore.subscribe,
    layoutStore.getSnapshot,
    layoutStore.getServerSnapshot,
  );
}

export function useCloseBehaviour(): CloseBehaviour {
  useProtoKeys();

  return useSyncExternalStore(
    closeStore.subscribe,
    closeStore.getSnapshot,
    closeStore.getServerSnapshot,
  );
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="wd-proto-group">
      <span className="wd-proto-label" aria-hidden="true">
        {label}
      </span>
      <div className="wd-proto-toggle" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="wd-proto-option"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The switcher itself. Two segmented controls, labelled as a prototype so
 * nobody mistakes them for shipped UI; they disappear with this file.
 */
export function ProtoToggles() {
  const layout = useProtoLayout();
  const close = useCloseBehaviour();
  const chooseLayout = useCallback((next: ProtoLayout) => setProtoLayout(next), []);
  const chooseClose = useCallback((next: CloseBehaviour) => setCloseBehaviour(next), []);

  return (
    <div className="wd-proto-toggles" data-drawer-chrome="">
      <ToggleGroup
        label="Prototype layout"
        options={[
          { value: "grid", label: "Grid" },
          { value: "list", label: "List" },
        ]}
        value={layout}
        onChange={chooseLayout}
      />
      <ToggleGroup
        label="Prototype back"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
        value={close}
        onChange={chooseClose}
      />
    </div>
  );
}
