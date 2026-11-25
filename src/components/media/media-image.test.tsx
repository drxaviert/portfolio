import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImageMedia } from "@/lib/media-types";
import { MediaImage } from "./media-image";

const media: ImageMedia = {
  id: "test-image-0000000000",
  kind: "image",
  width: 2560,
  height: 1440,
  alt: "Test image",
  caption: "Test",
  createdAt: "2026-11-24T00:00:00.000Z",
  original: "test.webp",
  lqip: "data:image/webp;base64,AAAA",
  sources: [
    {
      format: "avif",
      width: 640,
      url: "https://media.example.com/test/w640.avif",
    },
    {
      format: "webp",
      width: 640,
      url: "https://media.example.com/test/w640.webp",
    },
    {
      format: "avif",
      width: 2560,
      url: "https://media.example.com/test/w2560.avif",
    },
    {
      format: "webp",
      width: 2560,
      url: "https://media.example.com/test/w2560.webp",
    },
  ],
};

describe("MediaImage", () => {
  it("uses the whole source set by default", () => {
    const { container } = render(<MediaImage media={media} alt={media.alt} />);
    const img = container.querySelector("img");

    expect(img?.getAttribute("srcset")).toContain("w640.webp");
    expect(img?.getAttribute("srcset")).toContain("w2560.webp");
  });

  it("fullRes uses only the largest variant for the opened canvas view", () => {
    const { container } = render(
      <MediaImage media={media} alt={media.alt} fullRes />,
    );
    const img = container.querySelector("img");
    const avif = container.querySelector('source[type="image/avif"]');

    expect(img?.getAttribute("srcset")).toContain("w2560.webp");
    expect(img?.getAttribute("srcset")).not.toContain("w640.webp");
    expect(avif?.getAttribute("srcset")).toContain("w2560.avif");
    expect(avif?.getAttribute("srcset")).not.toContain("w640.avif");
  });
});
