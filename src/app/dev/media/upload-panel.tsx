"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HlsChoice, JobStage, JobView } from "./job-types";

type Kind = "image" | "video" | "";

type Staged = {
  key: string;
  file: File;
  kind: Kind;
  caption: string;
  audio: boolean;
  hls: HlsChoice;
  error?: string;
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "tif",
  "tiff",
]);
const VIDEO_EXTENSIONS = new Set(["mov", "mp4", "m4v", "webm", "mkv"]);

const ACTIVE_STAGES: JobStage[] = ["queued", "encoding", "uploading"];

const STAGE_TEXT: Record<JobStage, string> = {
  queued: "Waiting for the encoder",
  encoding: "Encoding",
  uploading: "Uploading to R2",
  done: "Done. It is in the grid below.",
  failed: "Upload failed",
};

const STAGE_FILL: Record<JobStage, number> = {
  queued: 0.08,
  encoding: 0.45,
  uploading: 0.8,
  done: 1,
  failed: 0,
};

function kindOf(name: string): Kind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "";
}

function isActive(job: JobView): boolean {
  return ACTIVE_STAGES.includes(job.stage);
}

/**
 * The drop zone, the pre-upload options and the encoder cards.
 *
 * Files are staged first so a caption or a flag can be set before the one
 * Upload press. After that the server queue owns them; this component only
 * polls for the stage and refreshes the page when a manifest lands.
 */
export function UploadPanel({ onIngested }: { onIngested: () => void }) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const stages = useRef(new Map<string, JobStage>());
  const ingested = useRef(new Set<string>());

  const onIngestedRef = useRef(onIngested);
  useEffect(() => {
    onIngestedRef.current = onIngested;
  }, [onIngested]);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const additions: Staged[] = Array.from(files).map((file) => ({
      key: `${file.name}:${file.size}:${file.lastModified}`,
      file,
      kind: kindOf(file.name),
      caption: "",
      audio: false,
      hls: "auto",
    }));

    if (additions.length === 0) return;

    setStaged((previous) => {
      const keys = new Set(additions.map((addition) => addition.key));
      return [...previous.filter((item) => !keys.has(item.key)), ...additions];
    });
    setAnnouncement(
      `${additions.length} ${
        additions.length === 1 ? "file" : "files"
      } ready. Set a caption, or upload now.`,
    );
  }, []);

  // The whole page is the target. A depth counter keeps the overlay up while
  // the pointer crosses child elements.
  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return event.dataTransfer?.types.includes("Files") ?? false;
    }

    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    }

    function onDragOver(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }

    function onDragLeave(event: DragEvent) {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    }

    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addFiles(event.dataTransfer?.files ?? null);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  // Poll only while a card is still moving.
  const activeKey = jobs
    .filter(isActive)
    .map((job) => job.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (activeKey === "") return;

    let cancelled = false;

    async function tick() {
      try {
        const response = await fetch("/dev/media/api/jobs", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as { jobs: JobView[] };
        if (cancelled) return;

        const byId = new Map(data.jobs.map((job) => [job.id, job]));

        setJobs((previous) => previous.map((job) => byId.get(job.id) ?? job));

        for (const job of data.jobs) {
          const before = stages.current.get(job.id);
          if (before === job.stage) continue;
          stages.current.set(job.id, job.stage);

          if (job.stage === "done" && !ingested.current.has(job.id)) {
            ingested.current.add(job.id);
            setAnnouncement(`${job.name} is ready.`);
            onIngestedRef.current();
          }
          if (job.stage === "failed") {
            setAnnouncement(`${job.name} failed. ${job.error ?? ""}`);
          }
        }
      } catch {
        // A dev-server restart is not worth a red card; the next tick retries.
      }
    }

    void tick();
    const timer = window.setInterval(tick, 800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeKey]);

  function update(key: string, patch: Partial<Staged>) {
    setStaged((previous) =>
      previous.map((item) =>
        item.key === key ? { ...item, ...patch, error: undefined } : item,
      ),
    );
  }

  async function uploadAll() {
    if (staged.length === 0 || uploading) return;

    setUploading(true);
    setAnnouncement(
      `Uploading ${staged.length} ${staged.length === 1 ? "file" : "files"}.`,
    );

    const results: { key: string; job?: JobView; error?: string }[] =
      await Promise.all(
        staged.map(async (item) => {
          const headers: Record<string, string> = {
            "x-media-name": encodeURIComponent(item.file.name),
            "x-media-hls": item.hls,
          };
          if (item.caption !== "") {
            headers["x-media-caption"] = encodeURIComponent(item.caption);
          }
          if (item.audio) headers["x-media-audio"] = "1";

          try {
            const response = await fetch("/dev/media/api/upload", {
              method: "POST",
              headers,
              body: item.file,
            });

            if (!response.ok) {
              const data = (await response.json().catch(() => ({}))) as {
                error?: string;
              };
              return {
                key: item.key,
                error:
                  data.error ??
                  `The dev server refused it (${response.status}).`,
              };
            }

            const data = (await response.json()) as { job: JobView };
            return { key: item.key, job: data.job };
          } catch {
            return {
              key: item.key,
              error: "Could not reach the dev server. Is it still running?",
            };
          }
        }),
      );

    const started = results.filter(
      (result): result is { key: string; job: JobView } =>
        result.job !== undefined,
    );
    const failed = results.filter(
      (result): result is { key: string; error: string } =>
        result.error !== undefined,
    );

    if (started.length > 0) {
      for (const entry of started) {
        stages.current.set(entry.job.id, entry.job.stage);
      }
      setJobs((previous) => [
        ...previous,
        ...started.map((entry) => entry.job),
      ]);
      const startedKeys = new Set(started.map((entry) => entry.key));
      setStaged((previous) =>
        previous.filter((item) => !startedKeys.has(item.key)),
      );
    }

    if (failed.length > 0) {
      setStaged((previous) =>
        previous.map((item) => {
          const match = failed.find((entry) => entry.key === item.key);
          return match ? { ...item, error: match.error } : item;
        }),
      );
      setAnnouncement(`${failed.length} file(s) could not be queued.`);
    }

    setUploading(false);
  }

  async function dismiss(id: string) {
    setJobs((previous) => previous.filter((job) => job.id !== id));
    stages.current.delete(id);
    ingested.current.delete(id);

    await fetch(`/dev/media/api/jobs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  const videoStaged = staged.filter((item) => item.kind === "video").length;

  return (
    <section className="mt-6" aria-label="Upload media">
      {dragging ? (
        // The visible Upload button is the overlay's text alternative; this is
        // the pointer-only affordance on top of it.
        <div className="mlib-drop" aria-hidden="true">
          <p className="text-lg font-medium">Drop to upload</p>
          <p className="text-sm text-on-surface-variant">
            Images and video land here, then you pick a caption.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="mlib-button min-h-11 bg-surface-container px-4 text-sm font-medium text-on-surface"
          onClick={() => inputRef.current?.click()}
        >
          Upload files
        </button>
        <p className="text-sm text-on-surface-variant">
          or drop them anywhere on this page
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {staged.length > 0 ? (
        <div className="mt-4 rounded-lg bg-surface-container-low p-3 shadow-card">
          <ul className="flex list-none flex-col gap-2">
            {staged.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-sm text-on-surface"
                  title={item.file.name}
                >
                  {item.file.name}
                </span>

                <label className="min-h-11 min-w-0 flex-1 sm:max-w-56">
                  <span className="sr-only">Caption for {item.file.name}</span>
                  <input
                    className="mlib-field h-11 w-full rounded-md px-3 text-sm text-on-surface"
                    placeholder="Caption (optional)"
                    value={item.caption}
                    onChange={(event) =>
                      update(item.key, { caption: event.target.value })
                    }
                  />
                </label>

                {item.kind === "video" ? (
                  <>
                    <label className="mlib-check">
                      <input
                        type="checkbox"
                        checked={item.audio}
                        onChange={(event) =>
                          update(item.key, { audio: event.target.checked })
                        }
                      />
                      With audio
                    </label>

                    <select
                      aria-label={`HLS for ${item.file.name}`}
                      className="mlib-field h-11 rounded-md px-2 text-sm text-on-surface"
                      value={item.hls}
                      onChange={(event) =>
                        update(item.key, {
                          hls: event.target.value as HlsChoice,
                        })
                      }
                    >
                      <option value="auto">HLS auto</option>
                      <option value="force">HLS force</option>
                      <option value="off">HLS off</option>
                    </select>
                  </>
                ) : null}

                <button
                  type="button"
                  className="mlib-button min-h-11 bg-surface-container px-3 text-sm font-medium text-on-surface"
                  onClick={() =>
                    setStaged((previous) =>
                      previous.filter((entry) => entry.key !== item.key),
                    )
                  }
                >
                  Remove
                </button>

                {item.error ? (
                  <p className="w-full text-xs leading-5 text-on-surface-variant">
                    {item.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="mlib-button min-h-11 bg-primary px-4 text-sm font-medium text-on-primary disabled:bg-surface-container disabled:text-on-surface-variant"
              onClick={uploadAll}
              disabled={uploading}
            >
              {uploading
                ? "Uploading…"
                : `Upload ${staged.length} ${
                    staged.length === 1 ? "file" : "files"
                  }`}
            </button>
            <p className="text-xs text-on-surface-variant tabular-nums">
              {videoStaged > 0
                ? "Video defaults to HLS auto: a ladder over 20 s, one MP4 under it."
                : "Captions are optional."}
            </p>
          </div>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <ul className="mt-4 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <article className="mlib-job">
                <div className="mlib-job-top">
                  <p className="break-all font-mono text-xs text-on-surface-variant">
                    {job.name}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-sm font-medium text-on-surface">
                    {STAGE_TEXT[job.stage]}
                  </p>

                  <div
                    className="mlib-progress"
                    role="presentation"
                    aria-hidden="true"
                  >
                    <span
                      style={{ transform: `scaleX(${STAGE_FILL[job.stage]})` }}
                    />
                  </div>

                  {job.stage === "failed" && job.error ? (
                    <p className="text-xs leading-5 whitespace-pre-wrap text-on-surface-variant">
                      {job.error}
                    </p>
                  ) : null}

                  {job.stage === "done" ? (
                    <p className="text-xs text-on-surface-variant">
                      The manifest is written. Copy its tag from the card below.
                    </p>
                  ) : null}

                  {job.stage === "failed" || job.stage === "done" ? (
                    <div className="mt-auto pt-1">
                      <button
                        type="button"
                        className="mlib-button min-h-11 bg-surface-container px-3 text-sm font-medium text-on-surface"
                        onClick={() => dismiss(job.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
