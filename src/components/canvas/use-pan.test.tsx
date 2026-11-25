import { act, fireEvent, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it } from "vitest";
import { usePan } from "./use-pan";

function downEvent(): ReactPointerEvent<HTMLDivElement> {
  return {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
    clientX: 10,
    clientY: 10,
  } as ReactPointerEvent<HTMLDivElement>;
}

describe("usePan lost release", () => {
  it("clears a pending drag when the window blurs", () => {
    const { result } = renderHook(() => usePan({}));
    const surface = document.createElement("div");
    result.current.containerRef.current = surface;

    act(() => {
      result.current.handlers.onPointerDown(downEvent());
    });
    expect(result.current.isDragging()).toBe(true);
    expect(surface).toHaveAttribute("data-dragging");

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current.isDragging()).toBe(false);
    expect(surface).not.toHaveAttribute("data-dragging");
  });

  it("accepts a new press after a pointerup that missed the surface", () => {
    const { result } = renderHook(() => usePan({}));
    const surface = document.createElement("div");
    result.current.containerRef.current = surface;

    act(() => {
      result.current.handlers.onPointerDown(downEvent());
    });
    expect(result.current.isDragging()).toBe(true);

    act(() => {
      fireEvent.pointerUp(window, {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        isPrimary: true,
        clientX: 600,
        clientY: 600,
      });
    });

    expect(result.current.isDragging()).toBe(false);
    expect(surface).not.toHaveAttribute("data-dragging");

    act(() => {
      result.current.handlers.onPointerDown(downEvent());
    });
    expect(result.current.isDragging()).toBe(true);
  });
});
