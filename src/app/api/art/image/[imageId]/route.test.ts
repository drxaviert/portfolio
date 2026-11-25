import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const IMAGE_ID = "0f8a5cbc-1234-4abc-9def-0123456789ab";

function context(imageId: string) {
  return { params: Promise.resolve({ imageId }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("painting image proxy", () => {
  it("rejects a non-AIC id before fetching", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/art/image/not-an-id"),
      context("not-an-id"),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects traversal and an unsupported width before fetching", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal("fetch", fetchMock);

    const traversal = await GET(
      new Request("http://localhost/api/art/image/../../etc/passwd"),
      context("../../etc/passwd"),
    );
    const wide = await GET(
      new Request(`http://localhost/api/art/image/${IMAGE_ID}?width=4000`),
      context(IMAGE_ID),
    );

    expect(traversal.status).toBe(400);
    expect(wide.status).toBe(400);
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
      new Request(`http://localhost/api/art/image/${IMAGE_ID}?width=1686`),
      context(IMAGE_ID),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);

    const [url, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;

    expect(url).toBe(
      `https://www.artic.edu/iiif/2/${IMAGE_ID}/full/1686,/0/default.jpg`,
    );
    expect(headers["AIC-User-Agent"]).toBe("Daily-Painting/1.0");
    expect(JSON.stringify(headers)).not.toContain("@");
  });

  it("returns a 502 when AIC refuses a valid request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("nope", { status: 403 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`http://localhost/api/art/image/${IMAGE_ID}`),
      context(IMAGE_ID),
    );

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
