import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom has no layout observers. The faux-UI scene hooks only use them to
 * scale and to pause offscreen, so a silent implementation leaves the initial
 * frame in place, the same state as a scene that has not been scrolled to yet.
 */
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  ObserverStub as unknown as typeof IntersectionObserver;

afterEach(() => {
  cleanup();
});
