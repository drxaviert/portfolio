"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { JSX, ReactNode } from "react";
import { HorizonBackground } from "@/components/horizon/horizon-background";
import { useSystemParams } from "@/lib/system/use-system-params";
import { SECTIONS } from "./sections";
import type { SectionId } from "./sections";

type SystemParams = ReturnType<typeof useSystemParams>;

export const SystemParamsContext = createContext<SystemParams | null>(null);

export function useSystem(): SystemParams {
  const value = useContext(SystemParamsContext);

  if (!value) {
    throw new Error("useSystem must be used within SystemShell");
  }

  return value;
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

  return (
    <SystemParamsContext value={system}>
      <div className="relative min-h-dvh text-on-surface">
        <HorizonBackground position="fixed" />

        <div className="relative mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:items-start lg:gap-10 lg:py-12">
          <header className="mb-8 lg:col-span-3 lg:mb-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-on-surface-variant">
              Foundations &amp; components
            </p>
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
                    aria-current={
                      current === section.id ? "location" : undefined
                    }
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
              className="w-full rounded-md bg-surface-container-low px-3 py-2 text-sm text-on-surface shadow-card"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          <main className="min-w-0 space-y-6">{children}</main>

          <aside
            aria-label="Controls"
            className="mt-8 lg:sticky lg:top-12 lg:mt-0 lg:self-start"
          />
        </div>
      </div>
    </SystemParamsContext>
  );
}
