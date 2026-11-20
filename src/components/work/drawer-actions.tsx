"use client";

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";

/**
 * The drawer's two ways out, handed across the server boundary. `Reader` and the
 * index are server-rendered, so the controls inside them cannot receive
 * functions; the client shell provides them through context instead.
 *
 * `close` leaves the whole drawer (the logo, and Esc on the index).
 * `stepBack` goes from a project to the index inside the drawer ("← Work",
 * browser Back, Esc and the backdrop on a project).
 */
export type DrawerActions = {
  close: () => void;
  stepBack: () => void;
};

const DrawerActionsContext = createContext<DrawerActions | null>(null);

export function DrawerActionsProvider({
  close,
  stepBack,
  children,
}: DrawerActions & { children: ReactNode }) {
  return (
    <DrawerActionsContext.Provider value={{ close, stepBack }}>
      {children}
    </DrawerActionsContext.Provider>
  );
}

/** The drawer's actions, for anything inside a server-rendered page. */
export function useDrawerActions(): DrawerActions | null {
  return useContext(DrawerActionsContext);
}

/** Escape runs the drawer's own step-back-or-close from anywhere, nav included. */
export function useEscToClose(onEscape: (() => void) | undefined) {
  useEffect(() => {
    if (!onEscape) return;

    const handle = onEscape;

    // A popover that handled this Escape calls preventDefault(). ThemeToggle
    // listens on document, which is on the event's path before window, so its
    // decision is already recorded by the time this runs: one Esc dismisses the
    // open row or menu, the next one steps the drawer back or closes it.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Auto-repeat from a held key is not a fresh press.
      if (event.repeat) return;
      event.preventDefault();
      handle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}
