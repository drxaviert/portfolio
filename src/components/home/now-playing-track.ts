/**
 * The one track the static player card plays. Title and artist come from the
 * video's YouTube oEmbed record (the " - Topic" suffix is not part of the
 * artist); the player reports the 6:15 duration on ready.
 */
export const NOW_PLAYING_TRACK = {
  videoId: "ZgCjWE9IqWU",
  title: "Door to the Cosmos",
  artist: "Chihei Hatakeyama",
  durationSeconds: 375,
  durationLabel: "6:15",
  /** Key of the self-hosted file, written by `pnpm post` (media/<id>/audio.mp3). */
  audioKey: "media/door-to-the-cosmos-601b1958e1/audio.mp3",
} as const;

/**
 * The self-hosted audio URL, or null when no media base is configured (then
 * the player falls back to the YouTube embed).
 */
export function audioUrlFor(
  track: { audioKey?: string },
  base: string | undefined = process.env.NEXT_PUBLIC_MEDIA_BASE,
): string | null {
  if (!track.audioKey || !base) return null;

  return `${base.replace(/\/+$/, "")}/${track.audioKey}`;
}

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
 * Total length rounds to the nearest second. Players usually report 374.9 for
 * a 6:15 video; the total stays 6:15 instead of flooring to 6:14.
 */
export function formatDuration(seconds: number) {
  const safe =
    Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;

  return formatTime(safe);
}
