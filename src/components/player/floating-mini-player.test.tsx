import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
  YouTubeState,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";
import { FloatingMiniPlayer } from "./floating-mini-player";

const mocks = vi.hoisted(() => ({ pathname: "/work" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const YT_STATE: YouTubeState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

beforeEach(() => {
  mocks.pathname = "/work";
});

function makeHarness() {
  const host = document.createElement("div");
  document.body.append(host);

  const handle: YouTubeHandle = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTime: vi.fn(() => 0),
    duration: vi.fn(() => 249),
    state: vi.fn(() => -1),
    destroy: vi.fn(),
  };

  let callbacks: YouTubeCallbacks | null = null;
  const createPlayer = vi.fn(
    (_host: HTMLElement, _videoId: string, next: YouTubeCallbacks) => {
      callbacks = next;
      return handle;
    },
  );
  const store = createPlayerStore({
    loadApi: async () => ({}) as never,
    createPlayer,
  });

  store.attachHost(host);

  cleanups.push(() => {
    store.destroy();
    host.remove();
  });

  async function playThrough() {
    store.play();
    await vi.waitFor(() => expect(createPlayer).toHaveBeenCalled());
    callbacks?.onReady(handle, YT_STATE, 249);
    await vi.waitFor(() => expect(handle.play).toHaveBeenCalled());
    callbacks?.onStateChange(1, handle);
  }

  return { store, handle, playThrough };
}

function region(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[role="region"]');
}

describe("floating mini player", () => {
  it("appears off-home while playing and links home from the cover and title", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);
    const pill = region(container);

    expect(pill).toHaveAttribute("data-visible", "true");
    expect(pill).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Get Lucky")).toBeInTheDocument();
    expect(screen.getByText("Daft Punk")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get Lucky by Daft Punk" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("button", { name: "Pause Get Lucky" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dismiss now playing" }),
    ).toBeInTheDocument();
  });

  it("stays hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);

    expect(region(container)).toHaveAttribute("data-visible", "false");
    expect(region(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("stays hidden while idle off-home", () => {
    const harness = makeHarness();
    const { container } = render(<FloatingMiniPlayer store={harness.store} />);

    expect(region(container)).toHaveAttribute("data-visible", "false");
  });

  it("stays visible off-home when paused after starting", async () => {
    const harness = makeHarness();

    await harness.playThrough();
    harness.store.pause();

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);

    expect(region(container)).toHaveAttribute("data-visible", "true");
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
  });

  it("stays out of the dev prototype routes", async () => {
    mocks.pathname = "/dev/prototype";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);

    expect(region(container)).toHaveAttribute("data-visible", "false");
  });

  it("dismisses by pausing and stays hidden until a new play", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss now playing" }),
    );

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(harness.store.getSnapshot().dismissed).toBe(true);
    expect(region(container)).toHaveAttribute("data-visible", "false");
  });

  it("toggles playback from the pill", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    render(<FloatingMiniPlayer store={harness.store} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause Get Lucky" }));

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play Get Lucky" }));

    expect(harness.store.getSnapshot().status).toBe("playing");
  });

  it("shows the shared playhead as a read-only progress line", async () => {
    const harness = makeHarness();

    await harness.playThrough();
    harness.store.seek(60);

    const { container } = render(<FloatingMiniPlayer store={harness.store} />);
    const fill = region(container)?.style.getPropertyValue("--mini-progress");

    expect(Number.parseFloat(fill ?? "")).toBeCloseTo(60 / 249, 3);
  });
});
