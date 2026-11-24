import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadR2Env, R2_ENV_KEYS, readR2PublicBaseUrl } from "./r2-env.ts";

const FILLED = [
  "R2_ACCOUNT_ID=account-123",
  "R2_ACCESS_KEY_ID=access-123",
  "R2_SECRET_ACCESS_KEY=super-secret-value",
  "R2_BUCKET=portfolio-media",
  "R2_PUBLIC_BASE_URL=https://media.example.com/",
].join("\n");

let root: string;
const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "r2-env-test-"));
  for (const key of R2_ENV_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  for (const key of R2_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  originalEnv.clear();
});

describe("loadR2Env", () => {
  it("loads all five keys and trims the public base URL", () => {
    writeFileSync(path.join(root, ".env.r2"), FILLED);

    expect(loadR2Env(root)).toEqual({
      accountId: "account-123",
      accessKeyId: "access-123",
      secretAccessKey: "super-secret-value",
      bucket: "portfolio-media",
      publicBaseUrl: "https://media.example.com",
    });
  });

  it("lets a real environment variable win over the file", () => {
    writeFileSync(path.join(root, ".env.r2"), FILLED);
    process.env.R2_ACCOUNT_ID = "from-shell";

    expect(loadR2Env(root).accountId).toBe("from-shell");
  });

  it("names every missing key without printing any value", () => {
    writeFileSync(
      path.join(root, ".env.r2"),
      "R2_ACCOUNT_ID=account-123\nR2_SECRET_ACCESS_KEY=super-secret-value\n",
    );

    let message = "";
    try {
      loadR2Env(root);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Missing R2 configuration in .env.r2");
    expect(message).toContain("R2_ACCESS_KEY_ID");
    expect(message).toContain("R2_BUCKET");
    expect(message).toContain("R2_PUBLIC_BASE_URL");
    expect(message).not.toContain("R2_ACCOUNT_ID");
    expect(message).not.toContain("super-secret-value");
    expect(message).not.toContain("account-123");
  });

  it("requires only the public URL when credentials are not needed", () => {
    writeFileSync(
      path.join(root, ".env.r2"),
      "R2_PUBLIC_BASE_URL=https://media.example.com\n",
    );

    expect(loadR2Env(root, { requireCredentials: false })).toMatchObject({
      publicBaseUrl: "https://media.example.com",
    });
  });

  it("rejects a non-https or malformed public URL", () => {
    writeFileSync(
      path.join(root, ".env.r2"),
      FILLED.replace("https://media.example.com/", "http://media.example.com"),
    );

    expect(() => loadR2Env(root)).toThrow(/must use https/);

    writeFileSync(
      path.join(root, ".env.r2"),
      FILLED.replace("https://media.example.com/", "not a url"),
    );

    expect(() => loadR2Env(root)).toThrow(/absolute https URL/);
  });
});

describe("readR2PublicBaseUrl", () => {
  it("reads the public base URL without requiring the other keys", () => {
    writeFileSync(
      path.join(root, ".env.r2"),
      "R2_PUBLIC_BASE_URL=https://media.example.com\n",
    );

    expect(readR2PublicBaseUrl(root)).toBe("https://media.example.com");
  });

  it("returns null when the file and environment have no URL", () => {
    expect(readR2PublicBaseUrl(root)).toBeNull();
  });
});
