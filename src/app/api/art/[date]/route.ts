import {
  getDailyArt,
  getTodaysArt,
  isWithinHistory,
  isValidDateKey,
} from "@/lib/daily-art";

/**
 * One day's painting for the card's browse controls.
 *
 * The date is validated before it reaches the cached loader; only the current
 * UTC day and the 29 before it are addressable. A failure inside the loader
 * already resolves to the bundled stand-in, so this route still returns 200
 * with a paintable record rather than breaking the card mid-browse.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;

  if (!isValidDateKey(date)) {
    return Response.json(
      { error: "Date must be a UTC day in YYYY-MM-DD form." },
      { status: 400 },
    );
  }

  const { today } = await getTodaysArt();

  if (!isWithinHistory(date, today)) {
    return Response.json(
      { error: "Date is outside the daily painting's 30-day window." },
      { status: 404 },
    );
  }

  const art = await getDailyArt(date);

  return Response.json(art, {
    headers: {
      "Cache-Control":
        date === today
          ? "public, max-age=300, stale-while-revalidate=3600"
          : "public, max-age=86400",
    },
  });
}
