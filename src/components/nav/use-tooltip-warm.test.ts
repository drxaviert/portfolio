import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOOLTIP_WARM_MS, useTooltipWarm } from "./use-tooltip-warm";

describe("useTooltipWarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("warms only once the first label's delay has passed", () => {
    const { result } = renderHook(() => useTooltipWarm());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(TOOLTIP_WARM_MS - 1));
    expect(result.current.warm).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.warm).toBe(true);
  });

  it("stays warm while the pointer moves inside the group", () => {
    const { result } = renderHook(() => useTooltipWarm());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(TOOLTIP_WARM_MS));
    act(() => result.current.onPointerLeave());
    act(() => result.current.onPointerEnter());

    expect(result.current.warm).toBe(true);

    // The re-enter cancelled the cold timer, so it never flips mid-pass.
    act(() => vi.advanceTimersByTime(TOOLTIP_WARM_MS * 2));
    expect(result.current.warm).toBe(true);
  });

  it("goes cold one delay after the pointer leaves the group", () => {
    const { result } = renderHook(() => useTooltipWarm());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(TOOLTIP_WARM_MS));
    act(() => result.current.onPointerLeave());

    expect(result.current.warm).toBe(true);

    act(() => vi.advanceTimersByTime(TOOLTIP_WARM_MS - 1));
    expect(result.current.warm).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.warm).toBe(false);
  });
});
