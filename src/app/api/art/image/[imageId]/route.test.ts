import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function context(imageId: string) {
  return { params: Promise.resolve({ imageId }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("painting image proxy", () => {
  it("rejects an unknown id or width without a network call", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal("fetch", fetchMock);

    const badId = await GET(
      new Request("http://localhost/api/art/image/not-an-id"),
      context("../../etc/passwd"),
    );
    const badWidth = await GET(
      new Request("http://localhost/api/art/image/abc?width=4000"),
      context("abc-123"),
    );

    expect(badId.status).toBe(404);
    expect(badWidth.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks AIC with the project header and serves immutable bytes", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/art/image/abc?width=1686"),
      context("abc-123"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);

    const [url, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;

    expect(url).toBe(
      "https://www.artic.edu/iiif/2/abc-123/full/1686,/0/default.jpg",
    );
    expect(headers["AIC-User-Agent"]).toBe("Daily-Painting/1.0");
    expect(JSON.stringify(headers)).not.toContain("@");
  });

  it("returns a 502 when AIC refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("nope", { status: 403 })),
    );

    const response = await GET(
      new Request("http://localhost/api/art/image/abc"),
      context("abc-123"),
    );

    expect(response.status).toBe(502);
  });
});
