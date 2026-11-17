import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WarmReader } from "./warm-reader";

describe("WarmReader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("warms the reader on idle once the page has loaded", () => {
    const requestIdleCallback = vi.fn(() => 7);

    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    const { container, unmount } = render(<WarmReader />);

    expect(container).toBeEmptyDOMElement();
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("cancels a pending warm-up on unmount", () => {
    const cancelIdleCallback = vi.fn();

    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn(() => 7),
    );
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

    render(<WarmReader />).unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });
});
