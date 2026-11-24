import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  createDryRunStore,
  createLocalStore,
  createR2Store,
  MEDIA_CACHE_CONTROL,
  r2Endpoint,
  type S3Sender,
} from "./media-store.ts";
import type { R2Env } from "./r2-env.ts";

const env: R2Env = {
  accountId: "account-123",
  accessKeyId: "access",
  secretAccessKey: "secret",
  bucket: "portfolio-media",
  publicBaseUrl: "https://media.example.com",
};

function sender(handler: (command: unknown) => Promise<unknown>): {
  client: S3Sender;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn(handler);
  return { client: { send }, send };
}

describe("r2Endpoint", () => {
  it("builds the account's S3 endpoint", () => {
    expect(r2Endpoint("abc123")).toBe(
      "https://abc123.r2.cloudflarestorage.com",
    );
  });
});

describe("createR2Store", () => {
  it("PUTs the key with the mapped content type and immutable cache", async () => {
    const { client, send } = sender(async () => ({}));
    const store = createR2Store(env, { client });
    const body = Buffer.from("bytes");

    const result = await store.put({
      key: "media/id/hls/master.m3u8",
      body,
    });

    expect(result).toEqual({
      url: "https://media.example.com/media/id/hls/master.m3u8",
      skipped: false,
    });

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: "portfolio-media",
      Key: "media/id/hls/master.m3u8",
      Body: body,
      ContentType: "application/vnd.apple.mpegurl",
      CacheControl: MEDIA_CACHE_CONTROL,
    });
  });

  it("HEADs first and skips an object already in R2", async () => {
    const { client, send } = sender(async (command) => {
      expect(command).toBeInstanceOf(HeadObjectCommand);
      return {};
    });
    const store = createR2Store(env, {
      client,
      skipExisting: true,
    });

    const result = await store.put({
      key: "media/id/video.mp4",
      body: Buffer.from("bytes"),
    });

    expect(result).toEqual({
      url: "https://media.example.com/media/id/video.mp4",
      skipped: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("treats a 404 HEAD as missing and then uploads", async () => {
    const { client, send } = sender(async (command) => {
      if (command instanceof HeadObjectCommand) {
        throw { name: "NotFound", $metadata: { httpStatusCode: 404 } };
      }
      return {};
    });
    const store = createR2Store(env, {
      client,
      skipExisting: true,
    });

    const result = await store.put({
      key: "media/id/video.mp4",
      body: Buffer.from("bytes"),
    });

    expect(result.skipped).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBeInstanceOf(PutObjectCommand);
  });

  it("does not swallow a non-404 HEAD failure", async () => {
    const { client } = sender(async () => {
      throw new Error("network down");
    });
    const store = createR2Store(env, {
      client,
      skipExisting: true,
    });

    await expect(
      store.put({ key: "media/id/video.mp4", body: Buffer.from("x") }),
    ).rejects.toThrow(/network down/);
  });

  it("mirrors an uploaded object into media/local when asked", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "media-mirror-test-"));
    try {
      const { client } = sender(async () => ({}));
      const store = createR2Store(env, {
        client,
        mirrorRoot: path.join(root, "media", "local"),
      });

      await store.put({
        key: "media/id/poster.jpg",
        body: Buffer.from("poster"),
      });

      expect(
        readFileSync(
          path.join(root, "media", "local", "media", "id", "poster.jpg"),
          "utf8",
        ),
      ).toBe("poster");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createDryRunStore", () => {
  it("returns the dry-run URL without a client", async () => {
    const store = createDryRunStore();
    const result = await store.put({
      key: "media/id/poster.jpg",
      body: Buffer.from("x"),
    });

    expect(store.kind).toBe("dry-run");
    expect(result).toEqual({
      url: "https://dry-run.invalid/media/id/poster.jpg",
      skipped: false,
    });
  });
});

describe("createLocalStore", () => {
  it("mirrors the R2 key under media/local and returns the public URL", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "media-local-test-"));
    try {
      const store = createLocalStore({
        root,
        publicBaseUrl: env.publicBaseUrl,
      });
      const result = await store.put({
        key: "media/id/hls/master.m3u8",
        body: Buffer.from("#EXTM3U\n"),
      });

      expect(result.url).toBe(
        "https://media.example.com/media/id/hls/master.m3u8",
      );
      expect(
        readFileSync(
          path.join(
            root,
            "media",
            "local",
            "media",
            "id",
            "hls",
            "master.m3u8",
          ),
          "utf8",
        ),
      ).toBe("#EXTM3U\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
