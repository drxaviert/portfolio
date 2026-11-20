"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./media-library.css";

/** One manifest, flattened to what a card draws. Bytes stay null for images. */
export type LibraryItem = {
  id: string;
  kind: "image" | "video";
  hls: boolean;
  width: number;
  height: number;
  /** Seconds; null for an image. */
  duration: number | null;
  /**
   * Total bytes the manifest records. An image manifest records none, so its
   * card says so instead of inventing a number.
   */
  bytes: number | null;
  createdAt: string;
  caption: string;
  alt: string;
  thumbnail: string;
  fullSize: string;
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date);
}

function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return `${unit === 0 ? String(value) : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function kindLabel(item: LibraryItem): string {
  if (item.kind === "image") return "Image";
  return item.hls ? "Video · HLS" : "Video";
}

/**
 * The async clipboard API needs a secure context, so it is missing on the LAN
 * URL Dat opens on a phone. The textarea path still copies there; it is the
 * only reason this tool needs a fallback at all.
 */
async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();

  const copied = document.execCommand("copy");
  field.remove();

  return copied;
}

function CopyButton({
  id,
  target,
  value,
  onResult,
}: {
  id: string;
  target: "tag" | "id";
  value: string;
  onResult: (message: string) => void;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function handleClick() {
    const copied = await writeClipboard(value);

    setState(copied ? "copied" : "failed");
    onResult(
      copied
        ? `Copied the ${target} for ${id}`
        : `Could not copy. Select the ${target} above instead.`,
    );

    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1500);
  }

  // The label swaps inside a fixed two-column cell, so nothing on the card
  // moves: no layout shift while the confirmation is up.
  return (
    <button
      type="button"
      className="mlib-button min-h-11 bg-surface-container px-3 text-sm font-medium text-on-surface"
      onClick={handleClick}
    >
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Copy failed"
          : target === "tag"
            ? "Copy tag"
            : "Copy id"}
    </button>
  );
}

function Card({
  item,
  onResult,
}: {
  item: LibraryItem;
  onResult: (message: string) => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg bg-surface-container-low shadow-card">
      <a
        className="mlib-thumb"
        href={item.fullSize}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${item.id} at full size in a new tab`}
      >
        {/* The manifest already encodes every width, so no optimiser request. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="mlib-thumb-img"
          src={item.thumbnail}
          alt={item.alt || item.caption || item.id}
          loading="lazy"
          decoding="async"
        />
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-mono text-sm leading-5 break-all text-on-surface">
            {item.id}
          </h2>
          <span className="shrink-0 rounded-sm bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            {kindLabel(item)}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-5">
          <dt className="text-on-surface-variant">Dimensions</dt>
          <dd className="tabular-nums text-on-surface">
            {item.width} × {item.height}
          </dd>

          <dt className="text-on-surface-variant">Size</dt>
          <dd className="tabular-nums text-on-surface">
            {item.bytes === null ? "not recorded" : formatBytes(item.bytes)}
          </dd>

          {item.duration === null ? null : (
            <>
              <dt className="text-on-surface-variant">Duration</dt>
              <dd className="tabular-nums text-on-surface">
                {formatDuration(item.duration)}
              </dd>
            </>
          )}

          <dt className="text-on-surface-variant">Created</dt>
          <dd className="text-on-surface">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </dd>
        </dl>

        <p
          className="line-clamp-2 text-sm leading-5 text-on-surface-variant"
          title={item.caption || undefined}
        >
          {item.caption || "No caption"}
        </p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <CopyButton
            id={item.id}
            target="tag"
            value={`<Media id="${item.id}" />`}
            onResult={onResult}
          />
          <CopyButton
            id={item.id}
            target="id"
            value={item.id}
            onResult={onResult}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * The dev library. Everything the page shows arrives as plain data from the
 * server, so this file owns only filter, search and the copy confirmation.
 */
export function MediaLibrary({ items }: { items: LibraryItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const images = items.filter((item) => item.kind === "image").length;
  const videos = items.length - images;
  const recorded = items.reduce((sum, item) => sum + (item.bytes ?? 0), 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (!needle) return true;

      return (
        item.id.toLowerCase().includes(needle) ||
        item.caption.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, query]);

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
        <header className="max-w-2xl">
          <h1 className="text-title-sm font-semibold md:text-title">
            Media library
          </h1>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Every manifest in{" "}
            <code className="font-mono text-on-surface">content/media</code>,
            newest first. Dev only: this route 404s in a production build.
          </p>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant tabular-nums">
            {items.length} {items.length === 1 ? "asset" : "assets"} · {images}{" "}
            {images === 1 ? "image" : "images"} · {videos}{" "}
            {videos === 1 ? "video" : "videos"}
          </p>
          <p
            className="text-sm leading-6 text-on-surface-variant tabular-nums"
            title="An image manifest records widths and URLs, not bytes."
          >
            {formatBytes(recorded)} of the 1 GB Hobby limit · video files only
          </p>
        </header>

        {items.length === 0 ? (
          <div className="mt-8 rounded-lg bg-surface-container-low p-6 shadow-card">
            <h2 className="text-lg font-medium">No media yet</h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-on-surface-variant">
              Drop a file in{" "}
              <code className="font-mono text-on-surface">media/inbox/</code>{" "}
              and run{" "}
              <code className="font-mono text-on-surface">pnpm post</code>. The
              manifest it writes shows up here after the dev server restarts.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Filter by kind"
                className="flex flex-wrap gap-2"
              >
                {FILTERS.map((option) => {
                  const active = filter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(option.value)}
                      className={`mlib-button min-h-11 px-3 text-sm font-medium ${
                        active
                          ? "bg-surface-bright text-on-surface shadow-card"
                          : "bg-surface-container text-on-surface"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto w-full sm:w-64">
                <label className="sr-only" htmlFor="media-search">
                  Search by id or caption
                </label>
                <input
                  id="media-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search id or caption"
                  className="mlib-field h-11 w-full rounded-md bg-surface-container px-3 text-sm text-on-surface shadow-card placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>

            <p
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status}
            </p>

            {visible.length === 0 ? (
              <div className="mt-8 rounded-lg bg-surface-container-low p-6 shadow-card">
                <p className="text-sm leading-6 text-on-surface">
                  No assets match that search.
                </p>
                <button
                  type="button"
                  className="mlib-button mt-3 min-h-11 bg-surface-container px-3 text-sm font-medium text-on-surface"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="mt-6 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((item) => (
                  <li key={item.id}>
                    <Card item={item} onResult={setStatus} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
