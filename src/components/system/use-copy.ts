"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_MS = 1500;

/**
 * Copy-to-clipboard status. "Copied" is shown against the copied text for
 * 1500ms, then reverts on its own.
 */
export function useCopy(): {
  copied: string | null;
  copy(text: string): void;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});

    setCopied(text);

    if (timer.current !== null) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      timer.current = null;
      setCopied(null);
    }, COPIED_MS);
  }, []);

  return { copied, copy };
}
