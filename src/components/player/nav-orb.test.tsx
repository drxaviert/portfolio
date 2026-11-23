import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
  YouTubeState,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import type { OffHomeVariant } from "./offhome-variant";
import { NavOrb } from "./nav-orb";

const mocks = vi.hoisted(() => ({ pathname: "/work", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
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

beforeEach(() => {
  mocks.pathname = "/work";
  mocks.push.mockReset();
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
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

function renderOrb(variant: OffHomeVariant, store: PlayerStore) {
  return render(
    <ThemeProvider>
      <NavOrb variant={variant} store={store} />
    </ThemeProvider>,
  );
}

describe("orb player variants", () => {
  it("keeps the idle ring variant as the normal Home link", () => {
    const harness = makeHarness();
    const { container } = renderOrb("ring", harness.store);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("button", { name: /hold for home/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".orb-ring")).toBeNull();
  });

  it("keeps the idle pill and satellite variants as the normal Home link", () => {
    const pillHarness = makeHarness();
    const pill = renderOrb("pill-orb", pillHarness.store);
    expect(pill.container.querySelector(".orb-pill")).toHaveAttribute(
      "data-visible",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Pause Get Lucky" }),
    ).not.toBeInTheDocument();
    pill.unmount();

    const satHarness = makeHarness();
    const sat = renderOrb("satellite", satHarness.store);
    expect(sat.container.querySelector(".orb-satellite")).toHaveAttribute(
      "data-visible",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Pause Get Lucky" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the ring off-home, toggles, and exposes a keyboard Home link", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb("ring", harness.store);
    const button = screen.getByRole("button", {
      name: "Pause, hold for home",
    });

    expect(container.querySelector(".orb-ring")).not.toBeNull();
    expect(container.querySelector("[data-ring-progress]")).not.toBeNull();
    expect(
      screen.getByText("Click to pause · hold for home"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "orb-home-alt",
    );

    fireEvent.click(button);

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(
      screen.getByRole("button", { name: "Play, hold for home" }),
    ).toBeInTheDocument();
  });

  it("tracks the shared time in the ring arc", async () => {
    const harness = makeHarness();

    await harness.playThrough();
    act(() => harness.store.seek(60));

    const { container } = renderOrb("ring", harness.store);
    const progress = container.querySelector("[data-ring-progress]");
    const dash = Number.parseFloat(
      progress?.getAttribute("stroke-dasharray") ?? "",
    );
    const expected = 2 * Math.PI * 22 * (60 / 249);

    expect(dash).toBeCloseTo(expected, 1);
  });

  it("holds the ring for 500ms to go home without toggling", async () => {
    vi.useFakeTimers();
    const harness = makeHarness();

    await harness.playThrough();

    renderOrb("ring", harness.store);

    const button = screen.getByRole("button", {
      name: "Pause, hold for home",
    });

    fireEvent.pointerDown(button, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(button).toHaveAttribute("data-holding", "true");

    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(harness.store.getSnapshot().status).toBe("playing");

    fireEvent.pointerUp(button, { pointerId: 1, pointerType: "mouse" });
    fireEvent.click(button);
    expect(harness.store.getSnapshot().status).toBe("playing");
  });

  it("keeps the ring hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb("ring", harness.store);

    expect(
      screen.queryByRole("button", { name: /hold for home/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".orb-ring")).toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the pill off-home, toggles, and truncates its text", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb("pill-orb", harness.store);
    const pill = container.querySelector(".orb-pill");
    const button = screen.getByRole("button", { name: "Pause Get Lucky" });

    expect(pill).toHaveAttribute("data-visible", "true");
    expect(screen.getByText("Get Lucky – Daft Punk")).toHaveClass("truncate");
    expect(container.querySelectorAll(".orb-pill-eq span")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );

    fireEvent.click(button);

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
  });

  it("keeps the pill hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb("pill-orb", harness.store);

    expect(container.querySelector(".orb-pill")).toHaveAttribute(
      "data-visible",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Pause Get Lucky" }),
    ).not.toBeInTheDocument();
  });

  it("shows the satellite off-home and toggles it", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb("satellite", harness.store);
    const satellite = container.querySelector(".orb-satellite");
    const button = screen.getByRole("button", { name: "Pause Get Lucky" });

    expect(satellite).toHaveAttribute("data-visible", "true");
    expect(satellite).toHaveAttribute("data-paused", "false");
    expect(button).toHaveClass("orb-satellite");
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

    const { container } = renderOrb("satellite", harness.store);

    expect(container.querySelector(".orb-satellite")).toHaveAttribute(
      "data-visible",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Pause Get Lucky" }),
    ).not.toBeInTheDocument();
  });
});
