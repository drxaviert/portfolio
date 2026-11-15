"use client";

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";

const ReaderCloseContext = createContext<(() => void) | null>(null);

/**
 * The overlay's close gesture, handed across the server boundary. `Reader` is a
 * server component, so the ways back inside it cannot receive a function; the
 * client shell provides it through context instead. The nav lives outside this
 * tree (root layout) and reaches the same close through `nav-flight.ts`.
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
 * server-rendered slot (the "← Work" rail).
 */
export function useReaderClose(): (() => void) | undefined {
  return useContext(ReaderCloseContext) ?? undefined;
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
