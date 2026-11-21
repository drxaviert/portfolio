import type { ReactNode } from "react";
import { HorizonLive } from "@/components/horizon/horizon-live";
import "./message-screen.css";

/** Inline action, in the reader's link language. */
export const MESSAGE_LINK =
  "text-on-surface underline decoration-outline underline-offset-2 hover:decoration-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The retry action: a small surface card, like the site's shadow-only chips. */
export const MESSAGE_BUTTON =
  "inline-flex h-9 items-center rounded-md bg-surface-container-low px-3 text-base font-medium text-on-surface shadow-card focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The message column: one kicker, title and body in the site's 1200px frame. */
export function MessageColumn({
  kicker,
  title,
  titleId,
  children,
}: {
  kicker: string;
  title: string;
  titleId?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-4 py-4 md:px-8 md:py-12 xl:py-[60px]">
      <div className="w-full max-w-[34rem]">
        <p className="text-xs font-medium tracking-[0.08em] text-on-surface-variant uppercase">
          {kicker}
        </p>
        <h1
          id={titleId}
          className="mt-3 text-balance text-title-sm font-semibold md:text-title"
        >
          {title}
        </h1>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-on-surface-variant">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The shell behind the two boundary screens (`not-found.tsx`, `error.tsx`): the
 * site's frame with one short message in the content column and the home
 * horizon behind it. The screens carry no nav, so the content fills the frame
 * and centres in it; `data-message-screen` is what hides the root layout's dock.
 * Neither screen animates in beyond that horizon — there is nothing to reveal,
 * so nothing is held back.
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
    <main
      data-message-screen=""
      className="relative flex min-h-svh flex-col overflow-hidden bg-surface text-on-surface"
    >
      <HorizonLive />

      <MessageColumn kicker={kicker} title={title}>
        {children}
      </MessageColumn>
    </main>
  );
}
