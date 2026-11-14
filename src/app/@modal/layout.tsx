"use client";

import { usePathname } from "next/navigation";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { OVERLAY_EXIT_EVENT } from "@/components/work/overlay-exit";

type Entry = { path: string; node: ReactNode };

/**
 * Presence for the intercepted page. The shell announces when its reverse morph
 * has landed; only then does this unmount the page it kept through the exit,
 * so the slot's route change cannot cut the morph short. Browser Back is the
 * exception the router owns: Next hides the slot in the same commit, so Back
 * leaves without the reverse (see expand-shell.tsx).
 */
export default function ModalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onWork = pathname.startsWith("/work/");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Remember the page while it is the active route. Adjusting state during
  // render (React's documented pattern) survives the pathname changing before
  // the slot has dropped its children.
  if (onWork && children && entry?.path !== pathname) {
    setEntry({ path: pathname, node: children });
  }

  // Reopening a study must run a fresh morph. A kept entry shares the returning
  // pathname's key, so React would reuse the finished reader (phase "open",
  // startedRef still set) and skip findCard entirely. Drop the entry as soon as
  // the route leaves the reader. Browser Back also takes this path: Next hides
  // the slot with React Activity in the same commit as the URL change, so no
  // exit morph can run there and the reader is gone before it could.
  if (!onWork && entry) {
    setEntry(null);
  }

  useEffect(() => {
    const path = entry?.path;
    if (!path) return;

    const onExit = () => setDismissed(path);
    window.addEventListener(OVERLAY_EXIT_EVENT, onExit);

    return () => window.removeEventListener(OVERLAY_EXIT_EVENT, onExit);
  }, [entry?.path]);

  const showing = onWork
    ? children
    : entry && dismissed !== entry.path
      ? entry.node
      : null;
  const key = onWork ? pathname : entry?.path;

  return isValidElement(showing) ? cloneElement(showing, { key }) : null;
}
