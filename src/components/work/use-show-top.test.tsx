import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useShowTop } from "./use-show-top";

/** jsdom has no layout, so the scroll box is a plain object with a height. */
function scrollBox(clientHeight: number): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });

  return element;
}

function scrollTo(element: HTMLElement, top: number) {
  act(() => {
    element.scrollTop = top;
    element.dispatchEvent(new Event("scroll"));
  });
}

describe("useShowTop", () => {
  it("is false while the reader is at the top", () => {
    const { result } = renderHook(() => useShowTop(scrollBox(600)));

    expect(result.current).toBe(false);
  });

  it("is true once the reader is more than one screen down", async () => {
    const element = scrollBox(600);
    const { result } = renderHook(() => useShowTop(element));

    scrollTo(element, 601);

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is false again at one screen or less", async () => {
    const element = scrollBox(600);
    const { result } = renderHook(() => useShowTop(element));

    scrollTo(element, 601);
    await waitFor(() => expect(result.current).toBe(true));

    scrollTo(element, 600);

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("stays false until the scroll container exists", async () => {
    const element = scrollBox(600);
    const { result, rerender } = renderHook(
      ({ scrollEl }: { scrollEl: HTMLElement | null }) => useShowTop(scrollEl),
      { initialProps: { scrollEl: null as HTMLElement | null } },
    );

    expect(result.current).toBe(false);

    rerender({ scrollEl: element });
    scrollTo(element, 601);

    await waitFor(() => expect(result.current).toBe(true));
  });
});
