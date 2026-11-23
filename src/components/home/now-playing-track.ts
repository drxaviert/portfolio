/**
 * The one track the static player card plays. Values come from the Paper file
 * "portfolio" (Static player · Pulled in, row 2, V1 Frosted).
 *
 * TODO_VIDEO_ID is the placeholder called out in the build brief: Daft Punk's
 * "Get Lucky" official audio. It is a real embeddable video, so the playback,
 * progress and four phase accents can be tested end to end. The title and
 * artist match it, and the duration is confirmed from the player once ready.
 */
export const TODO_VIDEO_ID = "5NV6Rdv1a3I";

export const NOW_PLAYING_TRACK = {
  videoId: TODO_VIDEO_ID,
  title: "Get Lucky",
  artist: "Daft Punk",
  /** Paper draws 4:09; the player confirms it on ready. */
  durationSeconds: 249,
  durationLabel: "4:09",
} as const;

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** maxres first; hq is the documented fallback when maxres is unavailable. */
export function thumbnailUrl(
  videoId: string,
  variant: "maxresdefault" | "hqdefault" = "maxresdefault",
) {
  return `https://i.ytimg.com/vi/${videoId}/${variant}.jpg`;
}

/** mm:ss, with hours only if a track ever needs them. */
export function formatTime(seconds: number) {
  const safe =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Total length rounds to the nearest second. Players usually report 248.9 for
 * a 4:09 video; the design's total stays 4:09 instead of flooring to 4:08.
 */
export function formatDuration(seconds: number) {
  const safe =
    Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;

  return formatTime(safe);
}
