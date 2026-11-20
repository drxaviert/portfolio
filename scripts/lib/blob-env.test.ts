import { describe, expect, it } from "vitest";
import { TOKEN_REFRESH_WINDOW_MS, tokenNeedsRefresh } from "./blob-env.ts";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Builds a JWT-shaped string; nothing here is signed or verified. */
function jwt(payload: Record<string, unknown>): string {
  const part = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.signature`;
}

describe("tokenNeedsRefresh", () => {
  it("keeps a token that outlives the refresh window", () => {
    expect(tokenNeedsRefresh(jwt({ exp: NOW / SECOND + 3600 }), NOW)).toBe(
      false,
    );
  });

  it("refreshes a token expiring inside the 15 minute window", () => {
    expect(tokenNeedsRefresh(jwt({ exp: NOW / SECOND + 5 * 60 }), NOW)).toBe(
      true,
    );
  });

  it("refreshes a token expiring exactly on the window edge", () => {
    const token = jwt({ exp: (NOW + TOKEN_REFRESH_WINDOW_MS) / SECOND });
    expect(tokenNeedsRefresh(token, NOW)).toBe(true);
  });

  it("keeps a token one second past the window edge", () => {
    const token = jwt({
      exp: (NOW + TOKEN_REFRESH_WINDOW_MS + SECOND) / SECOND,
    });
    expect(tokenNeedsRefresh(token, NOW)).toBe(false);
  });

  it("refreshes an already expired token", () => {
    expect(tokenNeedsRefresh(jwt({ exp: NOW / SECOND - MINUTE }), NOW)).toBe(
      true,
    );
  });

  it("refreshes when the token is missing or empty", () => {
    expect(tokenNeedsRefresh(undefined, NOW)).toBe(true);
    expect(tokenNeedsRefresh("", NOW)).toBe(true);
  });

  it("refreshes when the token cannot be decoded", () => {
    expect(tokenNeedsRefresh("not-a-jwt", NOW)).toBe(true);
    expect(tokenNeedsRefresh("a.!!!.c", NOW)).toBe(true);
  });

  it("refreshes when the payload has no numeric exp", () => {
    expect(tokenNeedsRefresh(jwt({ sub: "user" }), NOW)).toBe(true);
    expect(tokenNeedsRefresh(jwt({ exp: "soon" }), NOW)).toBe(true);
  });
});
