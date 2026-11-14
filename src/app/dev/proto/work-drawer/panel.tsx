"use client";

import { useEffect, useState } from "react";
import { pinPhase, unpinPhase } from "@/lib/theme";
import type { Phase } from "@/lib/theme";
import type { NavMode, Setup, Variant } from "./types";

/**
 * Dev-only control panel, top-right. Dark neutral glass so it never reads as
 * part of the site: setup (which cards open a case study), drawer treatment,
 * and the two themes this prototype has to survive.
 */

const SETUPS: { value: Setup; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "stack", label: "Stack" },
];

const VARIANTS: { value: Variant; label: string }[] = [
  { value: "sheet", label: "Sheet" },
  { value: "expand", label: "Expand" },
  { value: "side", label: "Side" },
];

const NAVS: { value: NavMode; label: string }[] = [
  { value: "stay", label: "Stay" },
  { value: "float", label: "Float" },
  { value: "header", label: "Header" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="wd-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="wd-seg-item"
          data-active={option.value === value ? "" : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DrawerPanel({
  setup,
  variant,
  nav,
  onSetup,
  onVariant,
  onNav,
}: {
  setup: Setup;
  variant: Variant;
  nav: NavMode;
  onSetup: (setup: Setup) => void;
  onVariant: (variant: Variant) => void;
  onNav: (nav: NavMode) => void;
}) {
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    return () => {
      unpinPhase();
    };
  }, []);

  function pickPhase(next: Phase) {
    setPhase(next);
    pinPhase(next);
  }

  return (
    <aside className="wd-panel" aria-label="Drawer prototype controls">
      <header className="wd-panel-head">
        <div>
          <p className="wd-panel-title">Work drawer</p>
          <p className="wd-panel-sub">case study · opening motion</p>
        </div>
        <button
          type="button"
          className="wd-panel-toggle"
          aria-expanded={open}
          aria-label={open ? "Hide controls" : "Show controls"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "–" : "+"}
        </button>
      </header>

      {open ? (
        <div className="wd-panel-body">
          <p className="wd-panel-group">Setup</p>
          <Segmented
            label="Setup"
            value={setup}
            options={SETUPS}
            onChange={onSetup}
          />

          <p className="wd-panel-group">Drawer</p>
          <Segmented
            label="Drawer style"
            value={variant}
            options={VARIANTS}
            onChange={onVariant}
          />

          <p className="wd-panel-group">Nav · expand only</p>
          <Segmented
            label="Nav treatment"
            value={nav}
            options={NAVS}
            onChange={onNav}
          />

          <p className="wd-panel-group">Theme</p>
          <div className="wd-seg" role="group" aria-label="Theme">
            <button
              type="button"
              className="wd-seg-item"
              data-active={phase === "day" ? "" : undefined}
              aria-pressed={phase === "day"}
              onClick={() => pickPhase("day")}
            >
              Day
            </button>
            <button
              type="button"
              className="wd-seg-item"
              data-active={phase === "night" ? "" : undefined}
              aria-pressed={phase === "night"}
              onClick={() => pickPhase("night")}
            >
              Night
            </button>
          </div>

          <p className="wd-panel-hint">
            {setup === "featured"
              ? "Click the big card to open it."
              : "Big card opens project 1; each sliver opens its own."}
            {variant === "expand"
              ? " The nav copy stays live in the reader."
              : ""}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
