import { describe, expect, it } from "vitest";
import { isSafariUserAgent } from "./environment";

const SAFARI_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

describe("isSafariUserAgent", () => {
  it("recognises desktop and iOS Safari", () => {
    expect(isSafariUserAgent(SAFARI_DESKTOP, "Apple Computer, Inc.")).toBe(
      true,
    );
    expect(isSafariUserAgent(SAFARI_IOS, "Apple Computer, Inc.")).toBe(true);
  });

  it("does not mistake other WebKit browsers for Safari", () => {
    expect(isSafariUserAgent(CHROME, "Google Inc.")).toBe(false);
    expect(isSafariUserAgent(CHROME_IOS, "Apple Computer, Inc.")).toBe(false);
    expect(isSafariUserAgent(EDGE, "Google Inc.")).toBe(false);
    expect(isSafariUserAgent(FIREFOX, "")).toBe(false);
  });
});
