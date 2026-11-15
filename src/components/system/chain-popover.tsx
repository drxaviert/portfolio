"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JSX } from "react";
import { chainFor, consumersOf } from "@/lib/system/nodes";

function coarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * The parameter -> primitive -> role chain for a token, plus the components
 * that consume it. Pointer users get it on hover/focus, touch users on tap;
 * Escape closes it and returns focus to the trigger.
 */
export function ChainPopover({ token }: { token: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({
    top: 0,
    left: 0,
    originX: 0,
  });
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const refocusing = useRef(false);
  const chain = chainFor(token);
  const consumers = consumersOf(token);

  const place = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );

    setPlacement({
      top: rect.bottom + 8,
      left,
      originX: Math.max(0, rect.left - left),
    });
  }, []);

  const close = useCallback(() => {
    // Focusing the trigger would otherwise fire onFocus and reopen the panel.
    refocusing.current = true;
    setOpen(false);
    triggerRef.current?.focus();
    refocusing.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;

    place();

    const onRecalculate = () => place();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current;

      if (wrapper && event.target instanceof Node && !wrapper.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onRecalculate);
    window.addEventListener("scroll", onRecalculate, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onRecalculate);
      window.removeEventListener("scroll", onRecalculate, true);
    };
  }, [open, close, place]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onBlur={(event) => {
        if (
          open &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="inline-flex h-7 items-center rounded-sm px-2 text-[11px] font-medium text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => {
          if (coarsePointer()) setOpen(true);
        }}
        onFocus={() => {
          if (refocusing.current) return;

          setOpen(true);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOpen(false);
        }}
      >
        Chain
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-label={`Chain for ${token}`}
        aria-hidden={open ? undefined : true}
        style={{
          top: placement.top,
          left: placement.left,
          transformOrigin: `${placement.originX}px 0px`,
        }}
        className={`fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-surface-container-high p-3 text-left shadow-card transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none ${
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-[0.96] opacity-0"
        }`}
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
          Derived from
        </p>
        <ol className="mt-2 space-y-1">
          {chain.map((node) => (
            <li key={node.id} className="flex min-w-0 items-baseline gap-2">
              <code className="min-w-0 truncate font-mono text-xs">
                {node.id}
              </code>
              <span className="truncate text-[11px] text-on-surface-variant">
                {node.label}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
          Used by
        </p>
        {consumers.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1">
            {consumers.map((consumer) => (
              <li
                key={consumer}
                className="rounded-sm bg-surface-container px-2 py-0.5 text-[11px]"
              >
                {consumer}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-on-surface-variant">
            No documented component yet.
          </p>
        )}
      </div>
    </div>
  );
}
