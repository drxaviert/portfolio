import { beforeEach, describe, expect, it, vi } from "vitest";

type Store = typeof import("./motion-ab");

/** A fresh module, so each test reads the URL its own way. */
async function freshStore(): Promise<Store> {
  vi.resetModules();

  return import("./motion-ab");
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  delete document.documentElement.dataset.b1;
  delete document.documentElement.dataset.motionReveal;
});

describe("motion A/B flags", () => {
  it("defaults to the shipped behaviour", async () => {
    const store = await freshStore();

    expect(store.motionAbFlags()).toEqual({ b1: false, reveal: false });
    expect(store.motionAbFromUrl()).toBe(false);
    expect(document.documentElement.hasAttribute("data-b1")).toBe(false);
  });

  it("reads either candidate from the URL", async () => {
    window.history.replaceState({}, "", "/?b1=1&reveal=1");
    const store = await freshStore();

    expect(store.motionAbFlags()).toEqual({ b1: true, reveal: true });
    expect(store.motionAbFromUrl()).toBe(true);
  });

  it("treats any other value as off, but a present param still asks for the pill", async () => {
    window.history.replaceState({}, "", "/?b1=0&reveal");
    const store = await freshStore();

    expect(store.motionAbFlags()).toEqual({ b1: false, reveal: false });
    expect(store.motionAbFromUrl()).toBe(true);
  });

  it("applies the flags to <html> for CSS", async () => {
    const store = await freshStore();

    store.applyMotionAb();
    expect(document.documentElement.hasAttribute("data-b1")).toBe(false);

    store.toggleMotionAbFlag("b1");
    expect(document.documentElement.dataset.b1).toBe("");
    expect(store.motionAbFlags().b1).toBe(true);

    store.toggleMotionAbFlag("b1");
    expect(document.documentElement.hasAttribute("data-b1")).toBe(false);
  });

  it("keeps the address bar in step with the pill", async () => {
    window.history.replaceState({}, "", "/?tune=1");
    const store = await freshStore();

    store.toggleMotionAbFlag("reveal");
    expect(window.location.search).toBe("?tune=1&reveal=1");

    store.toggleMotionAbFlag("reveal");
    expect(window.location.search).toBe("?tune=1");
  });
});
