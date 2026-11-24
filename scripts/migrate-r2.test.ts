import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import type {
  ImageMedia,
  MediaManifest,
  VideoMedia,
} from "../src/lib/media-types";
import { createR2Store } from "./lib/media-store.ts";
import type { R2Env } from "./lib/r2-env.ts";
import {
  findOriginal,
  planMigration,
  rewriteManifestUrls,
  type ArchiveFile,
} from "./migrate-r2.ts";

function archive(
  name: string,
  bytes = 100,
  dir = "media/archive",
): ArchiveFile {
  return { dir, name, path: `${dir}/${name}`, bytes };
}

const image: ImageMedia = {
  id: "cellixir-01-v01a-cf03dc7d17",
  kind: "image",
  width: 3840,
  height: 2160,
  alt: "Celixir still",
  caption: "",
  createdAt: "2026-11-20T00:00:00.000Z",
  original: "Cellixir_01_v01a.webp",
  sources: [
    {
      format: "avif",
      width: 640,
      url: "https://old.example.com/media/cellixir-01-v01a-cf03dc7d17/w640.avif",
    },
    {
      format: "webp",
      width: 640,
      url: "https://old.example.com/media/cellixir-01-v01a-cf03dc7d17/w640.webp",
    },
  ],
  lqip: "data:image/webp;base64,AAAA",
};

const video: VideoMedia = {
  id: "good-form-reel-4c969cc977",
  kind: "video",
  width: 1920,
  height: 1080,
  alt: "Good Form Rebrand",
  caption: "Good Form",
  createdAt: "2026-11-23T15:22:42.432Z",
  original: "Good Form-Reel.webm",
  mp4: {
    url: "https://old.example.com/media/good-form-reel-4c969cc977/video.mp4",
    bytes: 1_000,
  },
  canvas: {
    url: "https://old.example.com/media/good-form-reel-4c969cc977/canvas.mp4",
    bytes: 200,
  },
  hls: {
    url: "https://old.example.com/media/good-form-reel-4c969cc977/hls/master.m3u8",
    bytes: 2_000,
    levels: [{ height: 1080, bandwidth: 5_000_000 }],
  },
  poster: {
    avif: "https://old.example.com/media/good-form-reel-4c969cc977/poster.avif",
    jpg: "https://old.example.com/media/good-form-reel-4c969cc977/poster.jpg",
  },
  duration: 61,
  hasAudio: false,
};

const missing: ImageMedia = {
  ...image,
  id: "missing-fixture-0000000000",
  original: "missing-fixture.png",
  sources: image.sources.map((source) => ({
    ...source,
    url: source.url.replace(
      "cellixir-01-v01a-cf03dc7d17",
      "missing-fixture-0000000000",
    ),
  })),
};

const manifests: MediaManifest[] = [image, video, missing];

describe("findOriginal", () => {
  it("finds a file named exactly like the manifest original", () => {
    const exact = archive(
      "f874aa9e-71e7-4f6e-ac27-f084c7b7d08b-1-c-44e88e5097.jpg",
    );
    const manifest: ImageMedia = {
      ...image,
      id: "f874aa9e-71e7-4f6e-ac27-f084c7b7d08b-1-c-44e88e5097",
      original: "f874aa9e-71e7-4f6e-ac27-f084c7b7d08b-1-c-44e88e5097.jpg",
    };

    expect(findOriginal(manifest, [exact])).toBe(exact);
  });

  it("falls back to the pipeline's <id><extension> archive name", () => {
    const archived = archive("good-form-reel-4c969cc977.webm");

    expect(findOriginal(video, [archived])).toBe(archived);
  });

  it("is case-insensitive for the original filename", () => {
    const archived = archive("good form-reel.WEBM");

    expect(findOriginal(video, [archived])).toBe(archived);
  });

  it("returns undefined when no archive has the file", () => {
    expect(findOriginal(missing, [archive("other.webp")])).toBeUndefined();
  });
});

describe("planMigration", () => {
  it("separates migratable and missing manifests", () => {
    const plan = planMigration(manifests, [
      archive("cellixir-01-v01a-cf03dc7d17.webp", 300),
      archive("good-form-reel-4c969cc977.webm", 4_000),
    ]);

    expect(plan.manifests.map((item) => item.status)).toEqual([
      "migrate",
      "migrate",
      "missing",
    ]);
    expect(plan.totals).toMatchObject({
      manifests: 3,
      video: 1,
      image: 2,
      migrate: 2,
      missing: 1,
      objects: image.sources.length + 5 + missing.sources.length,
      recordedBytes: 3_200,
      sourceBytes: 4_300,
    });
  });

  it("counts every manifest URL but only the HLS master playlist", () => {
    const plan = planMigration([video], []);

    expect(plan.manifests[0].objects).toBe(5);
    expect(plan.manifests[0].hlsBytes).toBe(2_000);
    expect(plan.manifests[0].recordedBytes).toBe(3_200);
  });
});

describe("migrated uploads with a mocked S3 client", () => {
  it("plans one manifest and skips the object the mock already has", async () => {
    const env: R2Env = {
      accountId: "account",
      accessKeyId: "access",
      secretAccessKey: "secret",
      bucket: "bucket",
      publicBaseUrl: "https://media.example.com",
    };
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(HeadObjectCommand);
      return {};
    });
    const store = createR2Store(env, {
      client: { send },
      skipExisting: true,
    });
    const plan = planMigration(
      [image],
      [archive("cellixir-01-v01a-cf03dc7d17.webp")],
    );
    const key = new URL(image.sources[0].url).pathname.slice(1);

    const result = await store.put({
      key,
      body: Buffer.from("variant"),
    });

    expect(plan.totals.migrate).toBe(1);
    expect(result).toEqual({
      url: `https://media.example.com/${key}`,
      skipped: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("rewriteManifestUrls", () => {
  it("moves every video URL to the R2 base and keeps the key path", () => {
    const rewritten = rewriteManifestUrls(video, "https://media.example.com");
    if (rewritten.kind !== "video") throw new Error("expected video");

    expect(rewritten.mp4.url).toBe(
      "https://media.example.com/media/good-form-reel-4c969cc977/video.mp4",
    );
    expect(rewritten.canvas?.url).toBe(
      "https://media.example.com/media/good-form-reel-4c969cc977/canvas.mp4",
    );
    expect(rewritten.hls?.url).toBe(
      "https://media.example.com/media/good-form-reel-4c969cc977/hls/master.m3u8",
    );
    expect(rewritten.poster.avif).toBe(
      "https://media.example.com/media/good-form-reel-4c969cc977/poster.avif",
    );
    expect(rewritten.createdAt).toBe(video.createdAt);
    expect(rewritten.hls?.levels).toEqual(video.hls?.levels);
  });

  it("moves every image variant without touching the caption", () => {
    const withUrlCaption: ImageMedia = {
      ...image,
      caption: "https://this-is-copy.example.com",
    };
    const rewritten = rewriteManifestUrls(
      withUrlCaption,
      "https://media.example.com/",
    );

    expect(
      rewritten.kind === "image"
        ? rewritten.sources.map((source) => source.url)
        : [],
    ).toEqual([
      "https://media.example.com/media/cellixir-01-v01a-cf03dc7d17/w640.avif",
      "https://media.example.com/media/cellixir-01-v01a-cf03dc7d17/w640.webp",
    ]);
    expect(rewritten.caption).toBe("https://this-is-copy.example.com");
  });
});
