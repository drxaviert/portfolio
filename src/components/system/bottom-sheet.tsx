"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  JSX,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

const DRAG_THRESHOLD_PX = 40;
/** How much of the sheet is visible in the peek snap point. */
const PEEK_HEIGHT = "22rem";

/**
 * Phone controls sheet. Peek shows the parameter rows; a tap, Enter/Space or a
 * drag of more than 40px opens it to half height, where the Reset row and the
 * rest of the panel are reachable.
 *
 * Open is a real modal surface: focus moves in, Tab is trapped, Escape closes
 * and focus returns to the handle. Only transform/opacity animate (never
 * height or top), and reduced motion removes the transition entirely.
 */
export function BottomSheet({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragged = useRef(false);
  const focusOnOpen = useRef(true);

  const close = useCallback(() => {
    setOpen(false);
    handleRef.current?.focus();
  }, []);

  const openSheet = useCallback((focus: boolean) => {
    focusOnOpen.current = focus;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const sheet = sheetRef.current;

    if (!sheet) return;

    // A pointer drag opens the sheet from the handle; stealing focus there
    // would move it away from the control the finger is still on. Tap and
    // keyboard opens do move focus into the dialog.
    if (focusOnOpen.current) sheet.focus();

    const focusables = (): HTMLElement[] =>
      Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusables();

      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sheet)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    dragged.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;

    const delta = event.clientY - dragStartY.current;

    if (Math.abs(delta) <= DRAG_THRESHOLD_PX) return;

    dragged.current = true;

    if (delta < 0) {
      if (!open) openSheet(false);
    } else if (open) {
      close();
    }

    dragStartY.current = event.clientY;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartY.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onClick = () => {
    // A drag already chose the snap point; do not toggle back on release.
    if (dragged.current) {
      dragged.current = false;
      return;
    }

    if (open) close();
    else openSheet(true);
  };
  const sheetStyle: CSSProperties = {
    transform: open ? "translateY(0)" : `translateY(calc(100% - ${PEEK_HEIGHT}))`,
    paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={open ? close : undefined}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ease-out motion-reduce:transition-none lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        ref={sheetRef}
        id={panelId}
        role={open ? "dialog" : "region"}
        aria-modal={open ? true : undefined}
        aria-label={label}
        tabIndex={-1}
        style={sheetStyle}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[min(78dvh,42rem)] flex-col rounded-t-2xl bg-surface-container-low text-on-surface shadow-2xl outline-none transition-transform duration-[250ms] ease-out motion-reduce:transition-none lg:hidden"
      >
        <button
          ref={handleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex h-12 w-full shrink-0 touch-none items-center justify-center gap-2 rounded-t-2xl text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-outline"
          />
          {label}
        </button>

        <div
          data-sheet-content
          inert={!open}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        >
          {children}
        </div>
      </div>
    </>
  );
}
