import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/perf-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("perf report route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await post({
      report: { openCount: 1 },
      kind: "video",
      temperature: "cold",
    });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid kind in development", async () => {
    const response = await post({ report: {}, kind: "audio" });

    expect(response.status).toBe(400);
  });
});
