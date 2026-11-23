/**
 * The one track the static player card plays. The title, artist and drawn
 * duration come from the Paper file "portfolio" (Static player · Pulled in,
 * row 2, V1 Frosted) and stay as the design placeholder.
 *
 * TODO_VIDEO_ID is deliberately a technical placeholder, not the design's
 * track: Daft Punk's official "Get Lucky" audio (5NV6Rdv1a3I) returns YouTube
 * error 150 on the LAN origin (http://192.168.2.33:4310) in every tested
 * configuration — youtube-nocookie.com or youtube.com, with or without the
 * origin param, with a valid referer — while it plays on localhost. The same
 * player and origin play this YouTube IFrame API demo on both origins. Swap it
 * for the real track when the client supplies one; the player reports the
 * video's own duration on ready.
 */
export const TODO_VIDEO_ID = "M7lc1UVf-VE";

export const NOW_PLAYING_TRACK = {
  videoId: TODO_VIDEO_ID,
  title: "Get Lucky",
  artist: "Daft Punk",
  /** Paper draws 4:09; the placeholder video reports its own length on ready. */
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
