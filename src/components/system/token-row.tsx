"use client";

import { useEffect, useRef } from "react";
import type { JSX, ReactNode } from "react";
import { useSystem } from "@/app/design-system/system-shell";
import type { TokenMap } from "@/lib/system/derive";
import { ChainPopover } from "./chain-popover";
import { useCopy } from "./use-copy";

export type TokenRowProps = {
  token: string;
  usage: string;
  preview?: ReactNode;
};

/**
 * One documented token: preview, name, copy, chain and the live value.
 *
 * The swatch itself is CSS (`var(--token)`), and the value text is written
 * from the engine's frame subscription, so a parameter change repaints the
 * page without re-rendering every row through React state.
 */
export function TokenRow({
  token,
  usage,
  preview,
}: TokenRowProps): JSX.Element {
  const { engine } = useSystem();
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const { copied, copy } = useCopy();
  const isCopied = copied === token;

  useEffect(() => {
    let sawEngineValue = false;

    const apply = (tokens?: TokenMap) => {
      let value = tokens?.[token];

      if (value !== undefined) {
        sawEngineValue = true;
      } else if (!sawEngineValue) {
        // Only tokens the engine does not write (the text scale) are read back
        // from CSS; the engine already hands us the values it just set.
        value = window
          .getComputedStyle(document.documentElement)
          .getPropertyValue(token)
          .trim();
      }

      if (valueRef.current) valueRef.current.textContent = value || "—";
    };

    apply();

    return engine.subscribe((tokens) => apply(tokens));
  }, [engine, token]);

  return (
    <div
      data-token={token}
      className="flex min-w-0 items-start gap-3 rounded-md bg-surface-container-low p-3 shadow-card"
    >
      {preview ? <div className="shrink-0">{preview}</div> : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <code className="min-w-0 break-all font-mono text-xs">{token}</code>

          <button
            type="button"
            aria-label={isCopied ? `Copied ${token}` : `Copy ${token}`}
            onClick={() => copy(token)}
            className="h-7 rounded-sm px-2 text-[11px] font-medium text-on-surface-variant hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isCopied ? "Copied" : "Copy"}
          </button>

          <ChainPopover token={token} />
        </div>

        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          {usage}
        </p>

        <span
          ref={valueRef}
          className="mt-1 block truncate font-mono text-xs tabular-nums text-on-surface-variant"
        />
      </div>
    </div>
  );
}
