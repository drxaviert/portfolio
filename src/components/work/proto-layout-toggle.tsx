"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Prototype only: the sheet ships one layout once Dat picks it. Until then the
 * switcher reads `?layout=grid|list` (and the G / L keys) so the two can be
 * compared at any width and in either phase.
 *
 * The store is module-level so the URL, the keys and the control all agree
 * without a router navigation: changing the layout is not a page load.
 */

export type ProtoLayout = "grid" | "list";

const KEY = "layout";
const listeners = new Set<() => void>();
let layout: ProtoLayout | null = null;

function read(): ProtoLayout {
  const value = new URL(window.location.href).searchParams.get(KEY);

  return value === "list" ? "list" : "grid";
}

function getSnapshot(): ProtoLayout {
  layout ??= read();

  return layout;
}

/** The server cannot know the query string: it renders the default. */
function getServerSnapshot(): ProtoLayout {
  return "grid";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function setProtoLayout(next: ProtoLayout) {
  if (layout === next) return;

  layout = next;

  const url = new URL(window.location.href);
  url.searchParams.set(KEY, next);
  window.history.replaceState(window.history.state, "", url);

  for (const listener of listeners) listener();
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function useProtoLayout(): ProtoLayout {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      if (event.defaultPrevented || isTyping(event.target)) return;

      if (event.key === "g" || event.key === "G") setProtoLayout("grid");
      if (event.key === "l" || event.key === "L") setProtoLayout("list");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return current;
}

const OPTIONS: { value: ProtoLayout; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

/**
 * The switcher itself. Labelled as a prototype so nobody mistakes it for the
 * shipped control; it disappears with this file.
 */
export function ProtoLayoutToggle() {
  const layout = useProtoLayout();

  return (
    <div
      className="wd-proto-toggle"
      role="group"
      aria-label="Prototype layout"
      data-sheet-nodrag=""
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={layout === option.value}
          onClick={() => setProtoLayout(option.value)}
          className="wd-proto-option"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
