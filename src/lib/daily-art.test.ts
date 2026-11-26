import { describe, expect, it, vi } from "vitest";
import {
  type AicArtwork,
  fetchDailyArt,
  hashDateKey,
  isAcceptableAspect,
  isValidDateKey,
  pickArtwork,
  toDailyArt,
  utcDateKey,
} from "./daily-art";

const DATE = "2026-11-25";

function artwork(overrides: Partial<AicArtwork> = {}): AicArtwork {
  return {
    id: 1,
    title: "A painting",
    artist_title: "An artist",
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
    short_description: "<p>A painted <em>landscape</em>.</p>",
    description: null,
    ...overrides,
  };
}

function countResponse(total: number): Response {
  return Response.json({ pagination: { total }, data: [{ id: 1 }] });
}

function itemsResponse(items: AicArtwork[]): Response {
  return Response.json({ pagination: { total: items.length }, data: items });
}

function mockFetch(
  responses: Response[],
): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();

  for (const response of responses) fetchMock.mockResolvedValueOnce(response);

  return fetchMock;
}

describe("UTC day keys", () => {
  it("formats the instant in UTC, not local time", () => {
    expect(utcDateKey(new Date("2026-11-25T23:30:00-05:00"))).toBe(
      "2026-11-26",
    );
    expect(utcDateKey(new Date("2026-11-25T00:30:00+02:00"))).toBe(
      "2026-11-24",
    );
  });

  it("rejects impossible and malformed days", () => {
    expect(isValidDateKey("2026-11-25")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-1-01")).toBe(false);
    expect(isValidDateKey("today")).toBe(false);
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
  it("maps the AIC record, strips the synopsis HTML and keeps the image", () => {
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
      synopsis: "A painted landscape.",
      imageId: "image-1",
      width: 1200,
      height: 900,
      color: { h: 30, s: 40, l: 50 },
      articUrl: "https://www.artic.edu/artworks/1",
      fallback: false,
    });
    expect(daily?.synopsis).not.toContain("<");
    expect(daily?.lqip).toMatch(/^data:image\//);
    expect(daily?.alt).toBe("A painted landscape with a river.");
  });

  it("falls back to description and trims it to three sentences", () => {
    const daily = toDailyArt(
      artwork({
        short_description: null,
        description:
          "<p>First sentence. Second sentence &amp; detail. Third sentence? Fourth sentence.</p>",
      }),
      DATE,
    );

    expect(daily?.synopsis).toBe(
      "First sentence. Second sentence & detail. Third sentence?",
    );
    expect(daily?.synopsis.length).toBeLessThanOrEqual(220);
  });

  it("cuts one oversized sentence at a word boundary with an ellipsis", () => {
    const long = `${"Word ".repeat(60).trim()}.`;
    const daily = toDailyArt(
      artwork({ short_description: long, description: null }),
      DATE,
    );

    expect(daily?.synopsis.endsWith("…")).toBe(true);
    expect(daily?.synopsis.length).toBeLessThanOrEqual(220);
  });

  it("generates a factual line when AIC has no museum text", () => {
    const daily = toDailyArt(
      artwork({
        short_description: null,
        description: null,
        medium_display: "Oil on canvas",
        place_of_origin: "France",
        style_title: "Post-Impressionism",
        date_display: "1889",
        date_start: 1889,
      }),
      DATE,
    );

    expect(daily?.synopsis).toBe(
      "Oil on canvas, painted in France, 1889 — Post-Impressionism.",
    );
  });

  it("generates from whichever facts exist, without inventing the rest", () => {
    const daily = toDailyArt(
      artwork({
        short_description: null,
        description: null,
        medium_display: null,
        place_of_origin: null,
        style_title: "Realism",
        date_display: null,
        date_start: null,
      }),
      DATE,
    );

    expect(daily?.synopsis).toBe("Realism.");
  });

  it("uses a neutral line when every generated fact is missing", () => {
    const daily = toDailyArt(
      artwork({
        short_description: null,
        description: null,
        medium_display: null,
        place_of_origin: null,
        style_title: null,
        date_display: null,
        date_start: null,
      }),
      DATE,
    );

    expect(daily?.synopsis).toBe(
      "A painting from the Art Institute of Chicago.",
    );
  });

  it("falls back to honest labels for missing metadata", () => {
    const daily = toDailyArt(
      artwork({
        title: "  ",
        artist_title: null,
        date_display: null,
        date_start: null,
        medium_display: null,
        place_of_origin: null,
        style_title: null,
        short_description: null,
        description: null,
        color: null,
        thumbnail: { width: 1200, height: 900, lqip: null },
      }),
      DATE,
    );

    expect(daily?.title).toBe("Untitled");
    expect(daily?.artist).toBe("Unknown artist");
    expect(daily?.dateDisplay).toBe("Undated");
    expect(daily?.medium).toBe("Painting");
    expect(daily?.synopsis).toBe(
      "A painting from the Art Institute of Chicago.",
    );
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
      countResponse(5000),
      itemsResponse([
        artwork({ id: 31, thumbnail: { width: 9000, height: 1000 } }),
        artwork({ id: 32 }),
        artwork({ id: 33 }),
      ]),
    ]);

    const daily = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );

    expect(daily.fallback).toBe(false);
    expect(daily.date).toBe(DATE);
    expect(daily.id).toBeGreaterThanOrEqual(31);
    expect(daily.synopsis).toBe("A painted landscape.");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      const headers = init.headers as Record<string, string>;

      expect(call[0]).toBe("https://api.artic.edu/api/v1/artworks/search");
      expect(init.method).toBe("POST");
      expect(headers["AIC-User-Agent"]).toBe("Daily-Painting/1.0");
      expect(JSON.stringify(headers)).not.toContain("@");
      const body = JSON.stringify(init.body);

      expect(body).toContain("is_public_domain");
      expect(body).toContain("Painting");
    }

    // AIC rejects from + limit above 1,000 with a 403.
    const window = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);

    expect(window.from + window.limit).toBeLessThanOrEqual(1000);
    expect(window.fields).toContain("short_description");
    expect(window.fields).toContain("description");
  });

  it("returns the same painting for the same date", async () => {
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

    const first = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );
    const again = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );

    expect(first.id).toBe(again.id);
  });

  it("falls back to the bundled painting when the network fails", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const daily = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );

    expect(daily.fallback).toBe(true);
    expect(daily.date).toBe(DATE);
    expect(daily.imageId).toBeNull();
    expect(daily.title).toBeTruthy();
    expect(daily.synopsis).toContain("stand-in");
  });

  it("retries a transient HTTP failure once, then falls back", async () => {
    const failed = mockFetch([
      new Response("nope", { status: 503 }),
      new Response("still nope", { status: 503 }),
    ]);

    const daily = await fetchDailyArt(DATE, failed as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 403, which is a rejection rather than throttling", async () => {
    const denied = mockFetch([new Response("nope", { status: 403 })]);

    const daily = await fetchDailyArt(DATE, denied as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it("falls back on bad JSON", async () => {
    const broken = mockFetch([new Response("{", { status: 200 })]);
    const daily = await fetchDailyArt(DATE, broken as unknown as typeof fetch);

    expect(daily.fallback).toBe(true);
  });

  it("falls back when the collection is empty", async () => {
    const fetchMock = mockFetch([countResponse(0)]);

    const daily = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );

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

    const daily = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );

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
