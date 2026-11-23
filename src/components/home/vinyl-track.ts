/**
 * The one track the vinyl card plays. Values come from the Paper file
 * "portfolio" (Music card — explorations, 07 – Vinyl / spinning disc).
 *
 * TODO_VIDEO_ID is a stand-in. The design's 「不停的」 track does not have a
 * verifiable official YouTube video, so the card is wired to Daft Punk's
 * "Get Lucky" official audio (5NV6Rdv1a3I), which allows embedding and is a
 * real music video for testing the player end to end. Replace it with the real
 * track's id before shipping; the title and subtitle stay as drawn.
 */
export const TODO_VIDEO_ID = "5NV6Rdv1a3I";

export const VINYL_TRACK = {
  videoId: TODO_VIDEO_ID,
  title: "「不停的」",
  subtitle: "Official Music Video · YouTube",
  /**
   * The Paper card draws 3:48. The player replaces both once it is ready, so
   * this is only the server/first-paint value and the no-JS fallback.
   */
  durationSeconds: 228,
  durationLabel: "3:48",
} as const;

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function thumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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
