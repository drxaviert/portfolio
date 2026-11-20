import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { forgetOffset } from "@/components/home/carousel/carousel-memory";

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

/**
 * jsdom has no Web Animations. The study hand-off fades the outgoing column
 * before the route changes; tests only need the animation to exist and finish.
 */
Element.prototype.animate ??= (() => ({
  finished: Promise.resolve(),
  cancel() {},
})) as unknown as Element["animate"];

afterEach(() => {
  forgetOffset();
  cleanup();
});
