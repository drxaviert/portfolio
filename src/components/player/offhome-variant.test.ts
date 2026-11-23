import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("offhome variant", () => {
  it("reads the query once and keeps it across later URLs", async () => {
    const { rememberOffHomeVariant } = await import("./offhome-variant");

    expect(rememberOffHomeVariant("?offhome=nav")).toBe("nav");
    expect(rememberOffHomeVariant("?offhome=pill")).toBe("nav");
    expect(window.sessionStorage.getItem("offhome:v1")).toBe("nav");
  });

  it("defaults to pill", async () => {
    const { rememberOffHomeVariant } = await import("./offhome-variant");

    expect(rememberOffHomeVariant("")).toBe("pill");
  });

  it("restores a session choice after the query is gone", async () => {
    window.sessionStorage.setItem("offhome:v1", "nav");

    const { rememberOffHomeVariant } = await import("./offhome-variant");

    expect(rememberOffHomeVariant("")).toBe("nav");
  });

  it("lets the first explicit query override a stored choice", async () => {
    window.sessionStorage.setItem("offhome:v1", "nav");

    const { rememberOffHomeVariant } = await import("./offhome-variant");

    expect(rememberOffHomeVariant("?offhome=pill")).toBe("pill");
  });

  it.each(["ring", "pill-orb", "satellite"])(
    "accepts the orb variant %s",
    async (variant) => {
      const { rememberOffHomeVariant } = await import("./offhome-variant");

      expect(rememberOffHomeVariant(`?offhome=${variant}`)).toBe(variant);
    },
  );
});
