import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageReaderShell } from "./page-reader-shell";
import { useReaderClose } from "./reader-close";
import { hasReaderClose, registerReaderClose } from "@/components/nav/nav-flight";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  reduce: false,
  push: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    animate: mocks.animate as unknown as typeof actual.animate,
    useReducedMotion: () => mocks.reduce,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn(), prefetch: mocks.prefetch }),
}));

/** Hands the shell's close to the test, the way the rail reads it. */
let close: (() => void) | undefined;

function Probe() {
  const fromShell = useReaderClose();

  useEffect(() => {
    close = fromShell;
  }, [fromShell]);

  return null;
}

function placePageReader() {
  const panel = document.createElement("main");
  panel.className = "wd-reader-panel";
  panel.dataset.mode = "page";
  document.body.append(panel);

  return panel;
}

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.animate.mockReset();
  mocks.animate.mockReturnValue({
    finished: Promise.resolve(),
    complete: vi.fn(),
    stop: vi.fn(),
  });
  mocks.reduce = false;
  mocks.push.mockReset();
  mocks.prefetch.mockReset();
  close = undefined;
  delete document.documentElement.dataset.entrancePlayed;

  window.history.replaceState({}, "", "/work/systems-in-motion");
});

afterEach(() => {
  registerReaderClose(null);
  delete document.documentElement.dataset.entrancePlayed;
});

describe("PageReaderShell", () => {
  it("flies the page reader out, then leaves for home", async () => {
    const panel = placePageReader();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(close).toBeTypeOf("function"));

    act(() => { void close?.(); });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));

    expect(mocks.animate).toHaveBeenCalledWith(
      panel,
      { opacity: 0, y: 10 },
      { duration: 0.3, ease: "easeIn" },
    );
    expect(panel.style.opacity).toBe("0");
    expect(panel.style.pointerEvents).toBe("none");
  });

  it("keeps the 120ms fade under reduced motion", async () => {
    mocks.reduce = true;
    const panel = placePageReader();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(close).toBeTypeOf("function"));

    act(() => { void close?.(); });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));

    expect(mocks.animate).toHaveBeenCalledWith(
      panel,
      { opacity: 0 },
      { duration: 0.12, ease: "easeOut" },
    );
  });

  it("closes once, however often it is asked", async () => {
    placePageReader();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(close).toBeTypeOf("function"));

    act(() => {
      close?.();
      close?.();
    });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.animate).toHaveBeenCalledTimes(1);
  });

  it("leaves the route alone when it already moved during the exit", async () => {
    placePageReader();
    let finish!: () => void;
    mocks.animate.mockReturnValue({
      finished: new Promise<void>((resolve) => {
        finish = resolve;
      }),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(close).toBeTypeOf("function"));

    act(() => { void close?.(); });
    window.history.replaceState({}, "", "/work/title-sequence");
    act(() => finish());

    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("registers its close for the nav dock, and lets it go", async () => {
    placePageReader();

    const view = render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(hasReaderClose()).toBe(true));

    view.unmount();

    expect(hasReaderClose()).toBe(false);
  });

  it("warms the homepage route on mount", async () => {
    placePageReader();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(mocks.prefetch).toHaveBeenCalledWith("/"));
  });

  it("marks the document before leaving, so home paints resting", async () => {
    placePageReader();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    await waitFor(() => expect(close).toBeTypeOf("function"));

    act(() => {
      void close?.();
    });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("leaves for home even when the exit never finishes", async () => {
    // A paused frame loop (occluded window, background tab) never resolves the
    // animation; the route change must not wait on it.
    placePageReader();
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });
    vi.useFakeTimers();

    render(
      <PageReaderShell>
        <Probe />
      </PageReaderShell>,
    );

    expect(close).toBeTypeOf("function");

    act(() => {
      void close?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });

    expect(mocks.push).toHaveBeenCalledWith("/");
  });
});
