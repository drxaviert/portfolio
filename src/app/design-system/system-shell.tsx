"use client";

import {
  createContext,
  memo,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { HorizonLive } from "@/components/horizon/horizon-live";
import { BottomSheet } from "@/components/system/bottom-sheet";
import { ControlsPanel } from "@/components/system/controls-panel";
import type { SystemEngine } from "@/lib/system/engine";
import { useSystemParams } from "@/lib/system/use-system-params";
import { SECTIONS } from "./sections";
import type { SectionId } from "./sections";

type SystemParams = ReturnType<typeof useSystemParams>;

export const SystemParamsContext = createContext<SystemParams | null>(null);

/**
 * The engine facade never changes for the life of the shell. Consumers that
 * only need it (the token rows, motion demos, nav sample) subscribe here so a
 * parameter drag re-renders the controls, not hundreds of rows.
 */
export const SystemEngineContext = createContext<SystemEngine | null>(null);

type SystemActions = Pick<SystemParams, "setParam" | "reset">;

/** Stable writers, for samples that only need to move a parameter. */
export const SystemActionsContext = createContext<SystemActions | null>(null);

export function useSystem(): SystemParams {
  const value = useContext(SystemParamsContext);

  if (!value) {
    throw new Error("useSystem must be used within SystemShell");
  }

  return value;
}

export function useSystemActions(): SystemActions {
  const actions = useContext(SystemActionsContext);

  if (!actions) {
    throw new Error("useSystemActions must be used within SystemShell");
  }

  return actions;
}

export function useSystemEngine(): SystemEngine {
  const engine = useContext(SystemEngineContext);

  if (!engine) {
    throw new Error("useSystemEngine must be used within SystemShell");
  }

  return engine;
}

/**
 * Motion speed alone, through the engine. useSyncExternalStore compares the
 * number, so a drag that does not touch speed never re-renders the consumer.
 */
export function useSystemSpeed(): number {
  const engine = useSystemEngine();

  return useSyncExternalStore(
    (onStoreChange) => engine.subscribe(onStoreChange),
    () => engine.get().speed,
    () => 1,
  );
}

function subscribeToHash(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);

  return () => window.removeEventListener("hashchange", onStoreChange);
}

function readHash(): string {
  return window.location.hash;
}

/** The server renders the first section; the client follows the hash. */
function readServerHash(): string {
  return "";
}

function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, "");
  const match = SECTIONS.find((section) => section.id === id);

  return match ? match.id : SECTIONS[0].id;
}

const LINK_CLASS =
  "block rounded-md px-3 py-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface aria-[current=location]:bg-surface-container-high aria-[current=location]:font-medium aria-[current=location]:text-on-surface";

const ShellChrome = memo(function ShellChrome({
  current,
  engine,
  children,
}: {
  current: SectionId;
  engine: SystemEngine;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="relative min-h-dvh text-on-surface">
      <HorizonLive engine={engine} />

      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:items-start lg:gap-10 lg:py-12">
        <header className="mb-8 lg:col-span-3 lg:mb-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-on-surface-variant">
              Foundations &amp; components
            </p>
            <Link
              href="/"
              data-testid="portfolio-home"
              className="text-xs font-medium text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ← Portfolio
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            Design system
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            The tokens and components this portfolio actually ships. Change a
            source parameter and every value on the page derives again.
          </p>
        </header>

        <nav
          aria-label="Sections"
          className="hidden lg:sticky lg:top-12 lg:block lg:self-start"
        >
          <ol className="space-y-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={current === section.id ? "location" : undefined}
                  className={LINK_CLASS}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mb-6 lg:hidden">
          <select
            aria-label="Sections"
            value={current}
            onChange={(event) => {
              window.location.hash = event.target.value;
            }}
            className="w-full rounded-md bg-surface-container-low px-3 py-2 text-base text-on-surface shadow-card"
          >
            {SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </div>

        <main className="min-w-0 space-y-6 pb-[22rem] lg:pb-0">{children}</main>

        <aside
          aria-label="Controls"
          className="mt-8 lg:sticky lg:top-12 lg:mt-0 lg:self-start"
        >
          <div className="hidden lg:block">
            <ControlsPanel />
          </div>
        </aside>

        <BottomSheet label="Controls">
          <ControlsPanel />
        </BottomSheet>
      </div>
    </div>
  );
});

export function SystemShell({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const system = useSystemParams();
  const hash = useSyncExternalStore(
    subscribeToHash,
    readHash,
    readServerHash,
  );
  const current = sectionFromHash(hash);
  const actions = useMemo(
    () => ({ setParam: system.setParam, reset: system.reset }),
    [system.setParam, system.reset],
  );

  return (
    <SystemParamsContext value={system}>
      <SystemActionsContext value={actions}>
        <SystemEngineContext value={system.engine}>
          <ShellChrome current={current} engine={system.engine}>
            {children}
          </ShellChrome>
        </SystemEngineContext>
      </SystemActionsContext>
    </SystemParamsContext>
  );
}
