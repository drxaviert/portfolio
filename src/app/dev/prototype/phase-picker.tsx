"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { pinPhase, unpinPhase } from "@/lib/theme";
import type { Phase } from "@/lib/theme";

/**
 * Dev-only phase preview for the prototype route.
 *
 * Picking a phase pins it on <html> (`data-phase` plus `data-phase-preview`),
 * exactly the contract the other dev labs use, so tokens, the horizon
 * background, the nav orb and the ring hover glow recolour together and the
 * theme provider's clock leaves it alone. Clock removes the pin and re-applies
 * the current mode at the current local time.
 *
 * `?phase=night` deep-links a phase, and picking one rewrites the URL so the
 * current preview is always linkable.
 */

type Selection = Phase | "clock";

const OPTIONS: { value: Selection; label: string; accessibleName: string }[] = [
  { value: "dawn", label: "Dawn", accessibleName: "Dawn" },
  { value: "day", label: "Day", accessibleName: "Day" },
  { value: "dusk", label: "Dusk", accessibleName: "Dusk" },
  { value: "night", label: "Night", accessibleName: "Night" },
  {
    value: "clock",
    label: "Clock",
    accessibleName: "Clock, follow local time",
  },
];

function isPhase(value: string | null): value is Phase {
  return (
    value === "dawn" || value === "day" || value === "dusk" || value === "night"
  );
}

/** Server render and hydration start on Clock; the client follows the DOM. */
const SERVER_SELECTION: Selection = "clock";

/**
 * The pinned phase is the selection: data-phase + data-phase-preview are the
 * single source of truth, so the nav's theme toggle and a URL deep link both
 * show up here without a second copy of the state.
 */
function readSelection(): Selection {
  const root = document.documentElement;
  const phase = root.dataset.phase ?? null;

  return root.dataset.phasePreview === "true" && isPhase(phase)
    ? phase
    : "clock";
}

function subscribeToSelection(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-phase", "data-phase-preview"],
  });

  return () => observer.disconnect();
}

function phaseParam(): Phase | null {
  const value = new URLSearchParams(window.location.search).get("phase");

  return isPhase(value) ? value : null;
}

function writePhaseParam(selection: Selection): void {
  const url = new URL(window.location.href);

  if (selection === "clock") {
    url.searchParams.delete("phase");
  } else {
    url.searchParams.set("phase", selection);
  }

  window.history.replaceState(window.history.state, "", url);
}

function select(selection: Selection): void {
  if (selection === "clock") {
    unpinPhase();
  } else {
    pinPhase(selection);
  }

  writePhaseParam(selection);
}

function segmentClasses(active: boolean): string {
  return [
    "flex h-7 items-center rounded-[6px] px-2.5 text-xs font-medium whitespace-nowrap",
    "outline-hidden transition-colors duration-150",
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    active
      ? "bg-toggle-selected text-on-surface"
      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  ].join(" ");
}

export function PhasePicker() {
  const selection = useSyncExternalStore(
    subscribeToSelection,
    readSelection,
    () => SERVER_SELECTION,
  );

  // Pin the phase the URL asks for, and restore the real theme on the way out
  // so a client-side navigation does not carry the pin to another route.
  useEffect(() => {
    const pinned = phaseParam();

    if (pinned) pinPhase(pinned);

    return () => {
      if (document.documentElement.dataset.phasePreview !== "true") return;

      unpinPhase();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index + OPTIONS.length - 1) % OPTIONS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = OPTIONS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    select(OPTIONS[nextIndex].value);
    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  return (
    <div className="fixed right-3 bottom-3 z-50 md:right-4 md:bottom-4">
      <div
        role="radiogroup"
        aria-label="Preview phase"
        className="flex items-center gap-0.5 rounded-lg bg-surface-container-low p-1 shadow-card"
      >
        {OPTIONS.map((option, index) => {
          const active = option.value === selection;
          const isClock = option.value === "clock";

          return (
            <span key={option.value} className="flex items-center">
              {isClock ? (
                <span
                  aria-hidden="true"
                  className="mx-1 h-5 w-px bg-outline-variant"
                />
              ) : null}
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.accessibleName}
                tabIndex={active ? 0 : -1}
                onClick={() => select(option.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={segmentClasses(active)}
              >
                {option.label}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
