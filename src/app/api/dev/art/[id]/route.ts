import { fetchArtworkById } from "@/lib/daily-art";

/**
 * Dev-only artwork lookup for the homepage `?art=` override.
 *
 * The shipped card stays on the cached daily pick; this route is the one live
 * AIC read the dev override needs, keyed by AIC id. It is not cached and
 * production returns 404 before doing any work. A null mapping means AIC has
 * no usable record (missing image or museum text); a thrown fetch means AIC is
 * unreachable, which is a 502 rather than a 404.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { id } = await context.params;

  if (!/^\d{1,9}$/.test(id) || Number(id) <= 0) {
    return Response.json(
      { error: "AIC ids are positive integers." },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const art = await fetchArtworkById(Number(id));

    if (!art) {
      return Response.json(
        { error: `AIC artwork ${id} is unavailable or cannot be framed.` },
        { status: 404, headers: NO_STORE },
      );
    }

    return Response.json(art, { headers: NO_STORE });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[art-override] AIC ${id} could not be reached:`,
        error instanceof Error ? error.message : error,
      );
    }

    return Response.json(
      { error: "AIC is unavailable." },
      { status: 502, headers: NO_STORE },
    );
  }
}
