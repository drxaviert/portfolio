import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESSION_EXIT_MS,
  announceProgressionEntry,
  clearProgressionEntry,
  leaveForNextStudy,
  peekProgressionEntry,
} from "./progression";

function motion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  clearProgressionEntry();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("study hand-off", () => {
  it("offers the drawer to the mount that follows the route change", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);

    announceProgressionEntry(1);
    expect(peekProgressionEntry()).toEqual({ depth: 1 });

    clearProgressionEntry();
    expect(peekProgressionEntry()).toBeNull();
  });

  it("carries no depth for a Back/Forward, whose entry already has one", () => {
    announceProgressionEntry();

    expect(peekProgressionEntry()).toEqual({ depth: null });
  });

  it("expires a hand-off whose navigation never landed", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);

    announceProgressionEntry(1);
    now.mockReturnValue(1000 + 1501);

    expect(peekProgressionEntry()).toBeNull();
    // And it stays gone: a card open after the failed swap must not inherit it.
    now.mockReturnValue(1100);
    expect(peekProgressionEntry()).toBeNull();
  });

  it("fades the outgoing column on the close curve", async () => {
    motion(false);
    document.body.innerHTML = '<div class="wd-reader-scroll"></div>';
    const fade = vi.spyOn(Element.prototype, "animate");

    await leaveForNextStudy();

    expect(fade).toHaveBeenCalledWith([{ opacity: 1 }, { opacity: 0 }], {
      duration: PROGRESSION_EXIT_MS,
      easing: "ease-in",
      fill: "forwards",
    });
  });

  it("moves the route once the fade has left, not through the cut", async () => {
    motion(false);
    document.body.innerHTML = '<div class="wd-reader-scroll"></div>';
    vi.useFakeTimers();

    let moved = false;
    const handoff = leaveForNextStudy().then(() => {
      moved = true;
    });

    await vi.advanceTimersByTimeAsync(PROGRESSION_EXIT_MS - 1);
    expect(moved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await handoff;
    expect(moved).toBe(true);
  });

  it("keeps the reduced-motion swap motionless", async () => {
    motion(true);
    document.body.innerHTML = '<div class="wd-reader-scroll"></div>';
    const fade = vi.spyOn(Element.prototype, "animate");

    await leaveForNextStudy();

    // No fade and no wait: the incoming column takes the 120ms opacity pass.
    expect(fade).not.toHaveBeenCalled();
  });
});
