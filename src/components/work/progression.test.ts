import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESSION_EXIT_MS,
  PROGRESSION_LEAD_MS,
  announceProgressionEntry,
  clearProgressionLead,
  leaveForNextStudy,
  peekProgressionLead,
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
  clearProgressionLead();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("study hand-off", () => {
  it("offers a head start only to the mount that follows the hand-off", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);

    announceProgressionEntry();
    expect(peekProgressionLead()).toBe(PROGRESSION_LEAD_MS);

    clearProgressionLead();
    expect(peekProgressionLead()).toBe(0);
  });

  it("expires a lead whose navigation never landed", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);

    announceProgressionEntry();
    now.mockReturnValue(1000 + 901);

    expect(peekProgressionLead()).toBe(0);
    // And it stays gone: a card open after the failed swap must not inherit it.
    now.mockReturnValue(1100);
    expect(peekProgressionLead()).toBe(0);
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

  it("pushes the route before the fade ends, so the two overlap", async () => {
    motion(false);
    document.body.innerHTML = '<div class="wd-reader-scroll"></div>';
    vi.useFakeTimers();

    let pushed = false;
    const handoff = leaveForNextStudy().then(() => {
      pushed = true;
    });

    await vi.advanceTimersByTimeAsync(30);
    expect(pushed).toBe(false);

    // Past the push point but still short of the 140ms fade: the route moves
    // while the column is fading, not after it is empty.
    await vi.advanceTimersByTimeAsync(40);
    await handoff;
    expect(pushed).toBe(true);
  });

  it("keeps the reduced-motion swap motionless", async () => {
    motion(true);
    document.body.innerHTML = '<div class="wd-reader-scroll"></div>';
    const fade = vi.spyOn(Element.prototype, "animate");

    await leaveForNextStudy();

    // No fade and no wait: the content changes in one commit.
    expect(fade).not.toHaveBeenCalled();
  });
});
