import { describe, expect, it, vi } from "vitest";

const { connection, notFound } = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/server", () => ({ connection }));

import LiveHumanContactPage from "./page";

describe("live human contact page", () => {
  it("404s while the study is hidden", async () => {
    await expect(LiveHumanContactPage()).rejects.toThrow("NEXT_NOT_FOUND");

    // It renders per request: a prerender would bake the sunset 404 into the
    // build's static page list.
    expect(connection).toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });
});
