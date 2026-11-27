import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyArt } from "@/lib/daily-art";
import { ArtCard } from "./art-card";
import { ArtImage, artImageSrc } from "./art-image";
import { SHRED_SEGMENTS, shredStripMotion } from "./shred-strips";

const TODAY = "2026-11-25";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function art(overrides: Partial<DailyArt> = {}): DailyArt {
  return {
    date: TODAY,
    id: 9,
    title: "A painting",
    artist: "An artist",
    dateDisplay: "1850",
    dateStart: 1850,
    placeOfOrigin: "France",
    styleTitle: "Realism",
    medium: "Oil on canvas",
    synopsis:
      "A painted landscape with a river, seen in the soft light of an afternoon.",
    imageId: "image-1",
    width: 1200,
    height: 900,
    lqip: null,
    articUrl: "https://www.artic.edu/artworks/9",
    alt: "A painted landscape with a river.",
    fallback: false,
    ...overrides,
  };
}

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === REDUCE_QUERY ? reduced : false,
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
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCard(input = art()) {
  return render(<ArtCard art={input} />);
}

function loadPainting(container: HTMLElement) {
  const image = container.querySelector(".art-image img");

  if (!image) throw new Error("the painting image did not render");

  fireEvent.load(image as HTMLImageElement);
}

function disableNativeDialog() {
  const proto = window.HTMLDialogElement?.prototype;
  const showModal = proto?.showModal;
  const close = proto?.close;

  if (proto) {
    Object.defineProperty(proto, "showModal", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(proto, "close", {
      configurable: true,
      value: undefined,
    });
  }

  return () => {
    if (proto) {
      Object.defineProperty(proto, "showModal", {
        configurable: true,
        value: showModal,
      });
      Object.defineProperty(proto, "close", {
        configurable: true,
        value: close,
      });
    }
  };
}

describe("ArtCard", () => {
  it("renders today's label, the painting button and the full-screen trigger", () => {
    renderCard();

    expect(screen.getByText("Today’s painting")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();
    expect(screen.getByText("An artist")).toBeInTheDocument();
    expect(screen.getByText(/1850 · Oil on canvas/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "A painted landscape with a river, seen in the soft light of an afternoon.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View full screen" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
    expect(
      screen.getByRole("button", { name: "Shred the painting" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("omits the medium separator when the record has none", () => {
    renderCard(art({ medium: null }));

    expect(screen.getByText("1850")).toBeInTheDocument();
    expect(screen.queryByText("1850 · ")).not.toBeInTheDocument();
  });

  it("places the label before the frame and has no browsing controls or tilt", () => {
    const { container } = renderCard();
    const scene = container.querySelector(".art-card-scene");
    const order = Array.from(scene?.children ?? []).map(
      (child) => child.className,
    );
    const label = container.querySelector(".art-card-label");

    expect(order[0]).toContain("art-card-label");
    expect(order[1]).toContain("art-card-painting-button");
    expect(
      within(label as HTMLElement).getByRole("button", {
        name: "View full screen",
      }),
    ).toBeInTheDocument();
    expect(container.querySelector(".art-control")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Previous painting/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Next painting/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".painting-frame")).not.toHaveAttribute(
      "data-tilt",
    );
  });

  it("opens the full view from a click anywhere on the card", async () => {
    const user = userEvent.setup();
    const restoreDialog = disableNativeDialog();

    try {
      renderCard();

      await user.click(screen.getByText("An artist"));

      expect(screen.getByRole("dialog")).toHaveAttribute("open");
      expect(
        within(screen.getByRole("dialog")).getByRole("heading", {
          name: "A painting",
        }),
      ).toBeInTheDocument();
    } finally {
      restoreDialog();
    }
  });

  it("shreds the painting instead of opening the full view", async () => {
    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);

    const painting = screen.getByRole("button", { name: "Shred the painting" });

    await user.click(painting);

    await waitFor(() => {
      expect(container.querySelectorAll(".shred-strip")).toHaveLength(18);
    });

    expect(painting).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Finish the shred" })).toBe(
      painting,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      container
        .querySelector(".painting-frame-shred")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("builds each strip as a nested chain that curls outward", async () => {
    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);

    await user.click(
      screen.getByRole("button", { name: "Shred the painting" }),
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".shred-strip")).toHaveLength(18);
    });

    const strips = Array.from(container.querySelectorAll(".shred-strip"));

    for (const strip of strips) {
      const segments = strip.querySelectorAll(".shred-strip-segment");

      // The strip root is the first segment of the chain, inside a full-height track.
      expect(segments).toHaveLength(SHRED_SEGMENTS);
      expect(strip.querySelector(":scope > .shred-strip-track")).not.toBeNull();
      expect(strip.querySelectorAll("[data-root]")).toHaveLength(1);
      expect(
        strip.querySelector(".shred-strip-track > [data-root]"),
      ).not.toBeNull();
      // Nested, not siblings: each segment's parent is the previous segment.
      segments.forEach((segment, i) => {
        if (i > 0) expect(segment.parentElement).toBe(segments[i - 1]);
      });
    }

    // Left-half strips curl left (positive rotation, tip swings left), the
    // right half curls right, and the centre stays nearly straight.
    const total = (strip: Element) =>
      Array.from(strip.querySelectorAll(".shred-strip-segment")).reduce(
        (sum, segment) =>
          sum +
          Number.parseFloat(
            (segment as HTMLElement).style.getPropertyValue("--seg-rotate"),
          ),
        0,
      );
    const left = total(strips[0]);
    const right = total(strips.at(-1) as Element);

    expect(left).toBeGreaterThan(10);
    expect(left).toBeLessThan(30);
    expect(right).toBeLessThan(-10);
    expect(right).toBeGreaterThan(-30);
    expect(Math.abs(total(strips[9]))).toBeLessThan(3);
  });

  it("finishes the shred: exits, mounts the fresh copy, then returns to idle", async () => {
    const resolvers: Array<() => void> = [];
    let animateCalls = 0;

    vi.spyOn(Element.prototype, "animate").mockImplementation(() => {
      animateCalls += 1;

      return {
        finished: new Promise<void>((resolve) => resolvers.push(resolve)),
        cancel: vi.fn(),
      } as unknown as Animation;
    });

    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);

    const painting = screen.getByRole("button", { name: "Shred the painting" });

    await user.click(painting);
    expect(painting).toHaveAttribute("data-shred-phase", "shredding");
    expect(container.querySelector(".art-card-fresh")).toBeNull();

    resolvers.splice(0).forEach((resolve) => resolve());
    await waitFor(() =>
      expect(painting).toHaveAttribute("data-shred-phase", "shredded"),
    );
    expect(painting).toHaveAccessibleName("Finish the shred");

    animateCalls = 0;
    await user.click(painting);

    expect(painting).toHaveAttribute("data-shred-phase", "exiting");
    expect(container.querySelector(".art-card-fresh")).not.toBeNull();
    expect(container.querySelectorAll(".shred-strip")).toHaveLength(18);
    // Canvas + tracks + 18 strip falls + strips layer + fresh copy.
    expect(animateCalls).toBe(1 + 18 + 18 + 1 + 1);

    // Clicks during the exit are ignored.
    fireEvent.click(painting);
    expect(painting).toHaveAttribute("data-shred-phase", "exiting");

    resolvers.splice(0).forEach((resolve) => resolve());
    await waitFor(() =>
      expect(painting).toHaveAttribute("data-shred-phase", "idle"),
    );
    expect(container.querySelectorAll(".shred-strip")).toHaveLength(0);
    expect(container.querySelector(".art-card-fresh")).toBeNull();
    expect(painting).toHaveAttribute("aria-pressed", "false");
  });

  it("does not open the dialog when a ribbon is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);
    await user.click(
      screen.getByRole("button", { name: "Shred the painting" }),
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".shred-strip")).toHaveLength(18),
    );

    fireEvent.click(container.querySelector(".shred-strip-segment") as Element);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("brushing the ribbons sways them only with hover and motion allowed", async () => {
    const rects = () =>
      vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValue({
          left: 0,
          top: 0,
          right: 180,
          bottom: 100,
          width: 180,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        });
    const run = async (reduced: boolean, noHover: boolean) => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches:
            query === REDUCE_QUERY ? reduced : query === "(hover: none)" && noHover,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      rects();

      const user = userEvent.setup();
      const { container, unmount } = renderCard();

      loadPainting(container);
      await user.click(
        screen.getByRole("button", { name: /shred the painting/i }),
      );
      await waitFor(() =>
        expect(container.querySelectorAll(".shred-strip")).toHaveLength(18),
      );
      // Reduced motion lands directly on "shredded"; otherwise settle the mocked-away animations.
      const layer = container.querySelector(".shred-strips") as HTMLElement;

      await waitFor(() =>
        expect(
          container.querySelector("[data-shred-phase='shredded']"),
        ).not.toBeNull(),
      );

      const raf = vi.spyOn(window, "requestAnimationFrame");

      const pointer = (type: string, clientX: number, timeStamp: number) => {
        const event = new MouseEvent(type, { clientX, bubbles: false });

        Object.defineProperty(event, "timeStamp", { value: timeStamp });
        layer.dispatchEvent(event);
      };

      pointer("pointerenter", 10, 90);
      pointer("pointermove", 20, 100);
      pointer("pointermove", 120, 116);

      const called = raf.mock.calls.length > 0;

      unmount();
      raf.mockRestore();

      return called;
    };

    vi.spyOn(Element.prototype, "animate").mockImplementation(
      () =>
        ({
          finished: Promise.resolve(),
          cancel: vi.fn(),
        }) as unknown as Animation,
    );

    expect(await run(false, false)).toBe(true);
    expect(await run(true, false)).toBe(false);
    expect(await run(false, true)).toBe(false);
  });

  it("ignores clicks while the shred is animating", async () => {
    vi.spyOn(Element.prototype, "animate").mockImplementation(
      () =>
        ({
          finished: new Promise(() => {}),
          cancel: vi.fn(),
        }) as unknown as Animation,
    );

    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);

    const painting = screen.getByRole("button", { name: "Shred the painting" });

    expect(painting).toHaveAttribute("data-shred-phase", "idle");

    await user.click(painting);

    expect(painting).toHaveAttribute("data-shred-phase", "shredding");

    // A click during the descent is ignored rather than queued.
    fireEvent.click(painting);

    expect(painting).toHaveAttribute("data-shred-phase", "shredding");
    expect(painting).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".shred-strip")).toHaveLength(18);
  });

  it("disables shredding when the image has failed", () => {
    const { container } = renderCard();
    const image = container.querySelector(".art-image img");

    fireEvent.error(image as HTMLImageElement);

    const painting = screen.getByRole("button", { name: "Shred the painting" });

    expect(painting).toBeDisabled();

    fireEvent.click(painting);

    expect(container.querySelectorAll(".shred-strip")).toHaveLength(0);
    expect(painting).toHaveAttribute("aria-pressed", "false");
  });

  it("skips the web animation under reduced motion", async () => {
    stubMatchMedia(true);

    const animate = vi.spyOn(Element.prototype, "animate");
    const user = userEvent.setup();
    const { container } = renderCard();

    loadPainting(container);

    await user.click(
      screen.getByRole("button", { name: "Shred the painting" }),
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".shred-strip")).toHaveLength(18);
    });

    expect(animate).not.toHaveBeenCalled();
  });

  it("opens the full view, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    const restoreDialog = disableNativeDialog();

    try {
      renderCard();

      const trigger = screen.getByRole("button", { name: "View full screen" });

      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      const closeButton = screen.getByRole("button", {
        name: "Close full view",
      });

      expect(dialog).toHaveAttribute("open");
      expect(closeButton).toHaveFocus();
      expect(
        within(dialog).getByRole("heading", { name: "A painting" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "A painted landscape with a river, seen in the soft light of an afternoon.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Art Institute/ }),
      ).toHaveAttribute("href", "https://www.artic.edu/artworks/9");

      const dialogImage = dialog.querySelector(".art-image img");

      fireEvent.error(dialogImage as HTMLImageElement);

      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "image service did not respond",
      );

      // Tab from Close reaches the link; another Tab wraps back to Close.
      await user.tab();
      expect(screen.getByRole("link", { name: /Art Institute/ })).toHaveFocus();
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    } finally {
      restoreDialog();
    }
  });

  it("uses the native showModal/close path when the environment provides it", async () => {
    const user = userEvent.setup();
    const proto = window.HTMLDialogElement?.prototype;

    if (!proto) return;

    const originalShow = proto.showModal;
    const originalClose = proto.close;
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });

    Object.defineProperty(proto, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(proto, "close", {
      configurable: true,
      value: close,
    });

    try {
      renderCard();
      await user.click(
        screen.getByRole("button", { name: "View full screen" }),
      );

      expect(showModal).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog")).toHaveAttribute("open");

      await user.keyboard("{Escape}");

      expect(close).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(proto, "showModal", {
        configurable: true,
        value: originalShow,
      });
      Object.defineProperty(proto, "close", {
        configurable: true,
        value: originalClose,
      });
    }
  });

  it("clears the dialog image note when the dialog reopens", async () => {
    const user = userEvent.setup();
    const restoreDialog = disableNativeDialog();

    try {
      renderCard();

      const trigger = screen.getByRole("button", { name: "View full screen" });

      await user.click(trigger);

      const dialog = screen.getByRole("dialog");

      fireEvent.error(
        dialog.querySelector(".art-image img") as HTMLImageElement,
      );

      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "image service did not respond",
      );

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(trigger);

      const reopened = screen.getByRole("dialog");

      expect(within(reopened).queryByRole("status")).not.toBeInTheDocument();
      expect(reopened.querySelector(".art-image-unavailable")).toBeNull();
      expect(reopened.querySelector(".art-dialog-note")).toBeNull();
    } finally {
      restoreDialog();
    }
  });

  it("keys an image failure to the src and clears it on a successful load", () => {
    const onUnavailable = vi.fn();
    const onAvailable = vi.fn();
    const view = render(
      <ArtImage
        art={art({ imageId: "image-1" })}
        onUnavailable={onUnavailable}
        onAvailable={onAvailable}
      />,
    );

    fireEvent.error(view.container.querySelector("img") as HTMLImageElement);

    expect(onUnavailable).toHaveBeenCalledWith(artImageSrc("image-1", "card"));
    expect(
      view.container.querySelector(".art-image-unavailable"),
    ).not.toBeNull();

    view.rerender(
      <ArtImage
        art={art({ imageId: "image-2" })}
        onUnavailable={onUnavailable}
        onAvailable={onAvailable}
      />,
    );

    const nextImage = view.container.querySelector("img");

    expect(view.container.querySelector(".art-image-unavailable")).toBeNull();

    fireEvent.load(nextImage as HTMLImageElement);

    expect(onAvailable).toHaveBeenCalledWith(artImageSrc("image-2", "card"));
  });

  it("shows an intentional unavailable state when the painting image fails", () => {
    const { container } = renderCard();
    const image = container.querySelector(".art-image img");

    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector(".art-image-unavailable")).not.toBeNull();
    expect(container.querySelector(".painting-frame-window > svg")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "View full screen" });
    const describedBy = trigger.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(
      document.getElementById(describedBy as string)?.textContent,
    ).toContain("image service did not respond");
  });

  it("uses the plain ring surface with no wall or spotlight layer", () => {
    const { container } = renderCard();

    expect(container.querySelector(".ring-surface")).toHaveClass(
      "bg-surface-container-low",
    );
    expect(container.querySelector(".art-card")).toHaveClass("rounded-lg");
    expect(container.querySelector(".art-card-wall")).toBeNull();
    expect(container.querySelector(".art-card-light")).toBeNull();
    expect(container.querySelector(".art-card-vignette")).toBeNull();
    expect(container.querySelector(".art-card")).not.toHaveAttribute(
      "data-spotlight",
    );
  });
});

describe("shredStripMotion", () => {
  it("slices the painting continuously down the segment chain", () => {
    const [strip] = shredStripMotion(1, SHRED_SEGMENTS);
    const positions = strip.segments.map((segment) =>
      Number.parseFloat(segment.positionY),
    );

    expect(strip.segments).toHaveLength(SHRED_SEGMENTS);
    // Whole painting: first segment is the top, last the bottom, even steps.
    expect(positions[0]).toBe(0);
    expect(positions.at(-1)).toBe(100);

    const step = 100 / (SHRED_SEGMENTS - 1);

    positions.forEach((position, i) =>
      expect(position).toBeCloseTo(step * i, 1),
    );

    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]);
    }
  });

  it("keeps the root flush in the slot and grows the bend towards the tip", () => {
    const strips = shredStripMotion(18, SHRED_SEGMENTS);

    for (const strip of strips) {
      expect(strip.segments[0].rotate).toBe("0.00deg");

      const joints = strip.segments
        .slice(1)
        .map((segment) => Math.abs(Number.parseFloat(segment.rotate)));

      expect(joints.at(-1)).toBeGreaterThan(joints[0]);
    }
  });
});
