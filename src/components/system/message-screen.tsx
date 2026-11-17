import type { ReactNode } from "react";
import { HorizonLive } from "@/components/horizon/horizon-live";

/** Inline action, in the reader's link language. */
export const MESSAGE_LINK =
  "text-on-surface underline decoration-outline underline-offset-2 hover:decoration-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The retry action: a small surface card, like the site's shadow-only chips. */
export const MESSAGE_BUTTON =
  "inline-flex h-9 items-center rounded-md bg-surface-container-low px-3 text-base font-medium text-on-surface shadow-card focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The shell behind the two boundary screens (`not-found.tsx`, `error.tsx`): the
 * site's frame and nav slot, with one short message in the content column and
 * the home horizon behind it. Neither screen animates in beyond that horizon —
 * there is nothing to reveal, so nothing is held back.
 */
export function MessageScreen({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-surface text-on-surface">
      <HorizonLive />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-[60px]">
        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-[34rem]">
            <p className="text-xs font-medium tracking-[0.08em] text-on-surface-variant uppercase">
              {kicker}
            </p>
            <h1 className="mt-3 text-balance text-title-sm font-semibold md:text-title">
              {title}
            </h1>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-on-surface-variant">
              {children}
            </div>
          </div>
        </div>

        {/* The slot the nav settles into, as on the home layout: one HomeNav
            lives in the root layout and takes this box as its resting place. */}
        <div className="h-16" aria-hidden="true" data-nav-slot="" />
      </div>
    </main>
  );
}
