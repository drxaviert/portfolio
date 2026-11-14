"use client";

import { createContext, useContext, useEffect } from "react";
import type { MouseEvent, ReactNode } from "react";
import { HomeNav } from "@/components/home/home-nav";

const ReaderCloseContext = createContext<(() => void) | null>(null);

/**
 * The overlay's close gesture, handed across the server boundary. `Reader` is a
 * server component, so the nav slot below cannot receive a function; the client
 * shell provides it through context instead.
 */
export function ReaderCloseProvider({
  close,
  children,
}: {
  close: () => void;
  children: ReactNode;
}) {
  return (
    <ReaderCloseContext.Provider value={close}>
      {children}
    </ReaderCloseContext.Provider>
  );
}

/**
 * The overlay's close gesture, for anything inside the reader that sits in a
 * server-rendered slot (the nav, the "← Work" rail).
 */
export function useReaderClose(): (() => void) | undefined {
  return useContext(ReaderCloseContext) ?? undefined;
}

/** The nav slot inside the reader panel; a direct load has no shell to close. */
export function ReaderNavSlot() {
  const close = useReaderClose();

  return <ReaderNav onClose={close} />;
}

/** Escape closes the reader from anywhere, including from inside the nav. */
export function useEscToClose(onClose: (() => void) | undefined) {
  useEffect(() => {
    if (!onClose) return;

    const close = onClose;

    // A popover that handled this Escape calls preventDefault(). ThemeToggle
    // listens on document, which is on the event's path before window, so its
    // decision is already recorded by the time this runs: one Esc dismisses the
    // open row or menu, the next one leaves the reader.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}

/**
 * The real homepage nav, at the top of the reader. Its wrapper restores the
 * viewport width the homepage container measures against (see reader.css), so
 * left, width and height are the same CSS, not a measurement.
 *
 * In the overlay, the logo and "Work" play the reverse morph instead of
 * navigating; Play, About and the theme controls are untouched. A direct load
 * renders the same bar with `onClose` unset, so the links navigate normally.
 */
export function ReaderNav({ onClose }: { onClose?: () => void }) {
  useEscToClose(onClose);

  // Capture, not bubble: Next's Link prevents the default and starts routing in
  // its own click handler, which would otherwise outrun this one.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!onClose || event.defaultPrevented) return;
    if (event.button !== 0) return;

    const modified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified) return;

    if (!(event.target as Element).closest('a[href="/"]')) return;

    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return (
    <div className="wd-reader-nav">
      <div className="wd-reader-nav-inner">
        <div className="wd-reader-nav-bar" onClickCapture={onClickCapture}>
          <HomeNav />
        </div>
      </div>
    </div>
  );
}
