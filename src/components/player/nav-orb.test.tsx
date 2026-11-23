import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import { NavOrb } from "./nav-orb";

const mocks = vi.hoisted(() => ({ pathname: "/work" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
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
    callbacks?.onReady(handle, 249);
    await vi.waitFor(() => expect(handle.play).toHaveBeenCalled());
    callbacks?.onStateChange(1, handle);
  }

  return { store, handle, playThrough };
}

function renderOrb(store: PlayerStore) {
  return render(<NavOrb store={store} />);
}

describe("orb satellite control", () => {
  it("keeps the idle nav as the normal Home link", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    const satellite = container.querySelector(".orb-satellite");

    expect(satellite).toHaveAttribute("data-visible", "false");
    expect(satellite).toHaveAttribute("inert");
  });

  it("keeps the Home link before the satellite in DOM order", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);
    const shell = container.querySelector(".orb-shell");

    expect(shell?.firstElementChild?.tagName).toBe("A");
    expect(shell?.lastElementChild).toHaveClass("orb-satellite");
  });

  it("shows the satellite off-home, toggles, and parks as play when paused", async () => {
    mocks.pathname = "/work";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb(harness.store);
    const satellite = container.querySelector(".orb-satellite");
    const button = screen.getByRole("button", { name: "Pause Get Lucky" });

    expect(satellite).toHaveAttribute("data-visible", "true");
    expect(satellite).toHaveAttribute("data-paused", "false");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );

    fireEvent.click(button);

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(satellite).toHaveAttribute("data-paused", "true");
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
  });

  it("keeps the satellite hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb(harness.store);

    const satellite = container.querySelector(".orb-satellite");

    expect(satellite).toHaveAttribute("data-visible", "false");
    expect(satellite).toHaveAttribute("inert");
    expect(satellite).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps the satellite hidden while idle off-home", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);

    expect(container.querySelector(".orb-satellite")).toHaveAttribute(
      "data-visible",
      "false",
    );
  });
});
