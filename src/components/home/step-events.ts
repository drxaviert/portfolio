/**
 * The home carousel tells the rest of the page while a step runs, so things that
 * follow a pointer (the ring glow) can keep up with a card that moves under a
 * still pointer, in browsers that send no synthetic mouse move after a layout
 * change. Plain window events: nothing in the page needs to import the carousel.
 */
export const CAROUSEL_STEP_START = "wd:carousel-step-start";
export const CAROUSEL_STEP_END = "wd:carousel-step-end";

export function announceStep(kind: "start" | "end") {
  window.dispatchEvent(
    new Event(kind === "start" ? CAROUSEL_STEP_START : CAROUSEL_STEP_END),
  );
}
