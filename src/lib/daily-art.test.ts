import { describe, expect, it, vi } from "vitest";
import {
  type AicArtwork,
  fetchDailyArt,
  hashDateKey,
  historyStartDate,
  iiifUrl,
  isAcceptableAspect,
  isValidDateKey,
  isWithinHistory,
  pickArtwork,
  shiftDateKey,
  toDailyArt,
  utcDateKey,
} from "./daily-art";

const DATE = "2026-11-25";

function artwork(overrides: Partial<AicArtwork> = {}): AicArtwork {
  return {
    id: 1,
    title: "A painting",
    artist_title: "An artist",
    artist_display: "An artist (Somewhere, 1800-1899)",
    date_display: "1850",
    date_start: 1850,
    place_of_origin: "France",
    style_title: "Realism",
    image_id: "image-1",
    thumbnail: {
      width: 1200,
      height: 900,
      lqip: "data:image/gif;base64,R0lGOD",
      alt_text: "A painted landscape with a river.",
    },
    color: { h: 30, s: 40, l: 50 },
    medium_display: "Oil on canvas",
    ...overrides,
  };
}

function countResponse(total: number): Response {
  return Response.json({ pagination: { total }, data: [{ id: 1 }] });
}

function itemsResponse(items: AicArtwork[]): Response {
  return Response.json({ pagination: { total: items.length }, data: items });
}

function mockFetch(responses: Response[]): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();

  for (const response of responses) fetchMock.mockResolvedValueOnce(response);

  return fetchMock;
}

describe("UTC day keys", () => {
  it("formats the instant in UTC, not local time", () => {
    expect(utcDateKey(new Date("2026-11-25T23:30:00-05:00"))).toBe("2026-11-26");
    expect(utcDateKey(new Date("2026-11-25T00:30:00+02:00"))).toBe("2026-11-24");
  });

  it("steps across months, years and leap days", () => {
    expect(shiftDateKey("2026-11-25", -29)).toBe("2026-10-27");
    expect(shiftDateKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDateKey("2024-02-29", 1)).toBe("2024-03-01");
    expect(shiftDateKey("2024-12-31", 1)).toBe("2025-01-01");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("rejects impossible and malformed days", () => {
    expect(isValidDateKey("2026-11-25")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-1-01")).toBe(false);
    expect(isValidDateKey("today")).toBe(false);
    expect(() => shiftDateKey("nope", 1)).toThrow(RangeError);
  });

  it("keeps the browsable window at today plus the 29 before it", () => {
    expect(historyStartDate("2026-11-25")).toBe("2026-10-27");
    expect(isWithinHistory("2026-11-25", "2026-11-25")).toBe(true);
    expect(isWithinHistory("2026-10-27", "2026-11-25")).toBe(true);
    expect(isWithinHistory("2026-10-26", "2026-11-25")).toBe(false);
    expect(isWithinHistory("2026-11-26", "2026-11-25")).toBe(false);
  });
});

describe("aspect rejection", () => {
  it("accepts 4:1 and 1:4 exactly, rejects beyond", () => {
    expect(isAcceptableAspect(4000, 1000)).toBe(true);
    expect(isAcceptableAspect(1000, 4000)).toBe(true);
    expect(isAcceptableAspect(4001, 1000)).toBe(false);
    expect(isAcceptableAspect(1000, 4001)).toBe(false);
  });

  it("rejects missing, zero and non-finite dimensions", () => {
    expect(isAcceptableAspect(0, 1000)).toBe(false);
    expect(isAcceptableAspect(1000, 0)).toBe(false);
    expect(isAcceptableAspect(Number.NaN, 1000)).toBe(false);
    expect(isAcceptableAspect(Number.POSITIVE_INFINITY, 1000)).toBe(false);
  });

  it("can frame a landscape, portrait and panorama", () => {
    expect(isAcceptableAspect(1200, 900)).toBe(true);
    expect(isAcceptableAspect(900, 1200)).toBe(true);
    expect(isAcceptableAspect(3000, 1000)).toBe(true);
  });
});

describe("deterministic pick", () => {
  const paintings = Array.from({ length: 12 }, (_, index) =>
    artwork({ id: index + 1, title: `Painting ${index + 1}` }),
  );

  it("returns the same painting for the same day, twice", () => {
    const first = pickArtwork(paintings, DATE);
    const second = pickArtwork(paintings, DATE);

    expect(first?.id).toBe(second?.id);
    expect(first).not.toBeNull();
  });

  it("changes the pick on another day", () => {
    const first = pickArtwork(paintings, DATE);
    const next = pickArtwork(paintings, "2026-11-26");

    expect(first?.id).not.toBe(next?.id);
  });

  it("is independent of the API's order", () => {
    const first = pickArtwork(paintings, DATE);
    const reversed = pickArtwork([...paintings].reverse(), DATE);

    expect(first?.id).toBe(reversed?.id);
  });

  it("skips extreme aspect ratios and missing dimensions", () => {
    const wide = artwork({
      id: 2,
      thumbnail: { width: 9000, height: 1000 },
    });
    const missingImage = artwork({ id: 3, image_id: null });
    const good = artwork({ id: 4 });

    expect(pickArtwork([wide, missingImage, good], DATE)?.id).toBe(4);
    expect(pickArtwork([wide, missingImage], DATE)).toBeNull();
  });

  it("hashes the same string to the same unsigned number", () => {
    expect(hashDateKey(DATE)).toBe(hashDateKey(DATE));
    expect(hashDateKey(DATE)).not.toBe(hashDateKey("2026-11-26"));
    expect(hashDateKey(DATE)).toBeGreaterThanOrEqual(0);
  });
});

describe("toDailyArt", () => {
  it("maps the AIC record and both IIIF widths", () => {
    const daily = toDailyArt(artwork(), DATE);

    expect(daily).toMatchObject({
      date: DATE,
      id: 1,
      title: "A painting",
      artist: "An artist",
      dateDisplay: "1850",
      dateStart: 1850,
      placeOfOrigin: "France",
      styleTitle: "Realism",
      medium: "Oil on canvas",
      imageId: "image-1",
      width: 1200,
      height: 900,
      color: { h: 30, s: 40, l: 50 },
      articUrl: "https://www.artic.edu/artworks/1",
      fallback: false,
    });
    expect(daily?.imageUrl).toBe(iiifUrl("image-1", 843));
    expect(daily?.largeImageUrl).toBe(iiifUrl("image-1", 1686));
    expect(daily?.lqip).toMatch(/^data:image\//);
    expect(daily?.alt).toBe("A painted landscape with a river.");
  });

  it("falls back to honest labels for missing metadata", () => {
    const daily = toDailyArt(
      artwork({
        title: "  ",
        artist_title: null,
        date_display: null,
        date_start: null,
        medium_display: null,
        color: null,
        thumbnail: { width: 1200, height: 900, lqip: null },
      }),
      DATE,
    );

    expect(daily?.title).toBe("Untitled");
    expect(daily?.artist).toBe("Unknown artist");
    expect(daily?.dateDisplay).toBe("Undated");
    expect(daily?.medium).toBe("Painting");
    expect(daily?.color).toBeNull();
    expect(daily?.lqip).toBeNull();
    expect(daily?.alt).toContain("by Unknown artist");
  });

  it("refuses records without an image or usable dimensions", () => {
    expect(toDailyArt(artwork({ image_id: null }), DATE)).toBeNull();
    expect(
      toDailyArt(artwork({ thumbnail: { width: null, height: 900 } }), DATE),
    ).toBeNull();
    expect(
      toDailyArt(artwork({ thumbnail: { width: 9000, height: 1000 } }), DATE),
    ).toBeNull();
  });
});

describe("fetchDailyArt", () => {
  it("asks AIC with a generic header, counts, then frames a candidate", async () => {
    const fetchMock = mockFetch([
      countResponse(500),
      itemsResponse([
        artwork({ id: 31, thumbnail: { width: 9000, height: 1000 } }),
        artwork({ id: 32 }),
        artwork({ id: 33 }),
      ]),
    ]);

    const daily = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);

    expect(daily.fallback).toBe(false);
    expect(daily.date).toBe(DATE);
    expect(daily.id).toBeGreaterThanOrEqual(31);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      const headers = init.headers as Record<string, string>;

      expect(call[0]).toBe("https://api.artic.edu/api/v1/artworks/search");
      expect(init.method).toBe("POST");
      expect(headers["AIC-User-Agent"]).toBe("Daily-Painting/1.0");
      expect(JSON.stringify(headers)).not.toContain("@");
      expect(JSON.stringify(init.body)).toContain("is_public_domain");
      expect(JSON.stringify(init.body)).toContain("Painting");
    }
  });

  it("returns the same painting for the same date, and another the next day", async () => {
    const responses = () => [
      countResponse(200),
      itemsResponse(
        Array.from({ length: 24 }, (_, index) =>
          artwork({ id: index + 100, title: `Work ${index}` }),
        ),
      ),
      countResponse(200),
      itemsResponse(
        Array.from({ length: 24 }, (_, index) =>
          artwork({ id: index + 100, title: `Work ${index}` }),
        ),
      ),
    ];
    const fetchMock = mockFetch(responses());

    const first = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);
    const again = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);

    expect(first.id).toBe(again.id);
  });

  it("falls back to the bundled painting when the network fails", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const daily = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
    expect(daily.date).toBe(DATE);
    expect(daily.imageId).toBeNull();
    expect(daily.title).toBeTruthy();
  });

  it("falls back on a bad HTTP status or bad JSON", async () => {
    const failed = mockFetch([new Response("nope", { status: 503 })]);
    const broken = mockFetch([new Response("{", { status: 200 })]);

    expect((await fetchDailyArt(DATE, failed as unknown as typeof fetch)).fallback).toBe(
      true,
    );
    expect((await fetchDailyArt(DATE, broken as unknown as typeof fetch)).fallback).toBe(
      true,
    );
  });

  it("falls back when the collection is empty", async () => {
    const fetchMock = mockFetch([countResponse(0)]);

    const daily = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back when every candidate is unframable", async () => {
    const fetchMock = mockFetch([
      countResponse(2),
      itemsResponse([
        artwork({ id: 1, thumbnail: { width: 9000, height: 1000 } }),
        artwork({ id: 2, image_id: null }),
      ]),
    ]);

    const daily = await fetchDailyArt(DATE, fetchMock as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
  });

  it("rejects a malformed date before it reaches the network", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      fetchDailyArt("2026-02-30", fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
