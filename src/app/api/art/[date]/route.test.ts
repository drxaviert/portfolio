import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDailyArt } from "@/lib/daily-art";
import type { DailyArt } from "@/lib/daily-art";
import { GET } from "./route";

const TODAY = "2026-11-25";
const OLDEST = "2026-10-27";

function art(date: string): DailyArt {
  return {
    date,
    id: 9,
    title: "A painting",
    artist: "An artist",
    dateDisplay: "1850",
    dateStart: 1850,
    placeOfOrigin: "France",
    styleTitle: "Realism",
    medium: "Oil on canvas",
    imageId: "0f8a5cbc-1234-4abc-9def-0123456789ab",
    width: 1200,
    height: 900,
    lqip: null,
    color: { h: 30, s: 40, l: 50 },
    articUrl: "https://www.artic.edu/artworks/9",
    alt: "A painted landscape with a river.",
    fallback: false,
  };
}

vi.mock("@/lib/daily-art", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/daily-art")>();

  return {
    ...actual,
    getTodaysArt: vi.fn(async () => ({
      art: art(TODAY),
      today: TODAY,
      oldest: OLDEST,
    })),
    getDailyArt: vi.fn(async (date: string) => art(date)),
  };
});

function context(date: string) {
  return { params: Promise.resolve({ date }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/art/[date]", () => {
  it("rejects an impossible date before loading", async () => {
    const response = await GET(
      new Request("http://localhost/api/art/2026-02-30"),
      context("2026-02-30"),
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(getDailyArt)).not.toHaveBeenCalled();
  });

  it("rejects future days and days outside the 30-day window", async () => {
    const future = await GET(
      new Request("http://localhost/api/art/2026-11-26"),
      context("2026-11-26"),
    );
    const old = await GET(
      new Request("http://localhost/api/art/2026-10-26"),
      context("2026-10-26"),
    );

    expect(future.status).toBe(404);
    expect(old.status).toBe(404);
    expect(vi.mocked(getDailyArt)).not.toHaveBeenCalled();
  });

  it("returns a past day with an immutable daily cache header", async () => {
    const response = await GET(
      new Request("http://localhost/api/art/2026-11-24"),
      context("2026-11-24"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      date: "2026-11-24",
      title: "A painting",
    });
    expect(response.headers.get("Cache-Control")).toContain(
      "public, max-age=86400",
    );
    expect(vi.mocked(getDailyArt)).toHaveBeenCalledWith("2026-11-24");
  });

  it("keeps today on the short cache header", async () => {
    const response = await GET(
      new Request(`http://localhost/api/art/${TODAY}`),
      context(TODAY),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=300");
  });
});
