import type { DailyArt } from "@/lib/daily-art";

/**
 * Era and mount selection for the painting frame.
 *
 * AIC's date_start gives the century-ish bucket; East Asian works get one
 * extra rule because a tall hanging scroll is a mount, not just a frame. The
 * result is data only: painting-frame.css owns every colour and proportion, so
 * the frame is identical on the server and the client.
 */

export type FrameEra =
  "gilt-ornate" | "gilt-carved" | "walnut" | "modern" | "scroll";

export type FrameMount = "panel" | "hanging";

export type FrameStyle = {
  era: FrameEra;
  mount: FrameMount;
};

export type FrameArt = Pick<
  DailyArt,
  "dateStart" | "placeOfOrigin" | "width" | "height"
>;

const EAST_ASIAN = /japan|china|korea|chinese|japanese|korean/i;

/** Tall enough that a silk hanging-scroll mount reads correctly. */
const SCROLL_MAX_ASPECT = 0.62;

export function frameStyleFor(art: FrameArt): FrameStyle {
  const aspect = art.height > 0 ? art.width / art.height : 1;
  const eastAsian = Boolean(art.placeOfOrigin?.match(EAST_ASIAN));

  if (eastAsian && aspect < SCROLL_MAX_ASPECT) {
    return { era: "scroll", mount: "hanging" };
  }

  // An undated work has no era to match; walnut is the quiet default.
  if (art.dateStart === null) return { era: "walnut", mount: "panel" };

  if (art.dateStart < 1700) return { era: "gilt-ornate", mount: "panel" };
  if (art.dateStart < 1880) return { era: "gilt-carved", mount: "panel" };
  if (art.dateStart < 1945) return { era: "walnut", mount: "panel" };

  return { era: "modern", mount: "panel" };
}
