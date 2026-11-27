import { describe, expect, it, vi } from "vitest";
import {
  ART_DATA_VERSION,
  type AicArtwork,
  fetchDailyArt,
  getTodaysArt,
  hashDateKey,
  isAcceptableAspect,
  isValidDateKey,
  toDailyArt,
  utcDateKey,
} from "./daily-art";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

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

describe("date hash", () => {
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

  it("rejects a record without museum text", () => {
    expect(
      toDailyArt(artwork({ short_description: null, description: null }), DATE),
    ).toBeNull();
  });

  it("falls back to honest labels and never fabricates a medium", () => {
    const daily = toDailyArt(
      artwork({
        title: "  ",
        artist_title: null,
        date_display: null,
        date_start: null,
        medium_display: null,
        place_of_origin: null,
        style_title: null,
        description: null,
        thumbnail: { width: 1200, height: 900, lqip: null },
      }),
      DATE,
    );

    expect(daily?.title).toBe("Untitled");
    expect(daily?.artist).toBe("Unknown artist");
    expect(daily?.dateDisplay).toBe("Undated");
    expect(daily?.medium).toBeNull();
    expect(daily?.synopsis).toBe("A painted landscape.");
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

describe("getTodaysArt", () => {
  it("returns a non-empty synopsis from the public server entry", async () => {
    const fetchMock = mockFetch([countResponse(1), itemsResponse([artwork()])]);
    vi.stubGlobal("fetch", fetchMock);

    try {
      const daily = await getTodaysArt(ART_DATA_VERSION);

      expect(daily.synopsis.trim()).not.toBe("");
      expect(daily.synopsis).toBe("A painted landscape.");
    } finally {
      vi.unstubAllGlobals();
    }
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
      expect(headers["Content-Type"]).toBe("application/json");
      expect(JSON.stringify(headers)).not.toContain("@");
      const body = JSON.stringify(init.body);

      expect(body).toContain("is_public_domain");
      expect(body).toContain("Painting");

      const parsed = JSON.parse(init.body as string);

      expect(parsed.query.bool.should).toEqual([
        { exists: { field: "short_description" } },
        { exists: { field: "description" } },
      ]);
      expect(parsed.query.bool.minimum_should_match).toBe(1);
    }

    // AIC rejects from + limit above 1,000 with a 403.
    const window = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);

    expect(window.from + window.limit).toBeLessThanOrEqual(1000);
    expect(window.fields).toContain("short_description");
    expect(window.fields).toContain("description");
  });

  it("scans a mixed page for the first described, framable record", async () => {
    const fetchMock = mockFetch([
      countResponse(133375),
      itemsResponse([
        artwork({ id: 40, short_description: null, description: null }),
        artwork({
          id: 41,
          short_description: "<p>A described but extreme work.</p>",
          thumbnail: { width: 9000, height: 1000 },
        }),
        artwork({
          id: 42,
          short_description: "<p>A described work with no image.</p>",
          image_id: null,
        }),
        artwork({
          id: 43,
          title: "Described work",
          short_description: "<p>The real museum description.</p>",
        }),
      ]),
    ]);

    const daily = await fetchDailyArt(
      DATE,
      fetchMock as unknown as typeof fetch,
    );
    const page = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);

    expect(daily.id).toBe(43);
    expect(daily.synopsis).toBe("The real museum description.");
    expect(daily.fallback).toBe(false);
    expect(page.limit).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  const liveDescribe = process.env.LIVE_AIC === "1" ? describe : describe.skip;

  liveDescribe("live AIC totals (LIVE_AIC=1; recorded 2026-11-26)", () => {
    const url = "https://api.artic.edu/api/v1/artworks/search";
    const must = [
      { term: { is_public_domain: true } },
      { term: { "artwork_type_title.keyword": "Painting" } },
      { exists: { field: "image_id" } },
    ];
    const described = [
      { exists: { field: "short_description" } },
      { exists: { field: "description" } },
    ];

    async function totalFor(
      clauseMust: unknown[],
      clauseShould?: unknown[],
    ): Promise<number | undefined> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "AIC-User-Agent": "Daily-Painting/1.0",
        },
        body: JSON.stringify({
          query: {
            bool: {
              must: clauseMust,
              ...(clauseShould
                ? { should: clauseShould, minimum_should_match: 1 }
                : {}),
            },
          },
          fields: ["id"],
          limit: 1,
          from: 0,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      expect(response.ok).toBe(true);

      const json = (await response.json()) as {
        pagination?: { total?: number };
      };

      return json.pagination?.total;
    }

    it("applies public-domain, painting, image and description filters", async () => {
      const cases = [
        { name: "public-domain", must: [must[0]], total: 62285 },
        { name: "+painting", must: must.slice(0, 2), total: 2029 },
        { name: "+image", must, total: 1936 },
        {
          name: "+description",
          must,
          should: described,
          total: 758,
        },
      ];
      const observed = [];

      for (const item of cases) {
        observed.push({
          name: item.name,
          total: await totalFor(item.must, item.should),
        });
      }

      expect(observed).toEqual(
        cases.map((item) => ({ name: item.name, total: item.total })),
      );
    }, 60_000);

    it("sees the described total from the app's count request", async () => {
      type LiveBody = {
        query: {
          bool: { should: unknown; minimum_should_match: number };
        };
      };
      const calls: Array<{ body: LiveBody; total?: number }> = [];
      const liveFetch = (async (
        input: string,
        init: RequestInit,
      ): Promise<Response> => {
        const response = await fetch(input, init);
        const json = (await response.clone().json()) as {
          pagination?: { total?: number };
        };

        calls.push({
          body: JSON.parse(init.body as string) as LiveBody,
          total: json.pagination?.total,
        });

        return response;
      }) as unknown as typeof fetch;
      const daily = await fetchDailyArt(DATE, liveFetch);

      expect(calls[0].total).toBe(758);
      expect(calls[0].body.query.bool.should).toEqual(described);
      expect(calls[0].body.query.bool.minimum_should_match).toBe(1);
      expect(daily.fallback).toBe(false);
      expect(daily.synopsis.trim()).not.toBe("");
    }, 60_000);
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
