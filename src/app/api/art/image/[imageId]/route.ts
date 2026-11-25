import { AIC_USER_AGENT } from "@/lib/daily-art";

/**
 * Same-origin proxy for the Art Institute's IIIF image.
 *
 * The image CDN sits behind Cloudflare and answers 403 ("Just a moment…") to a
 * request without `AIC-User-Agent`; browsers cannot send that header on an
 * <img>, and Next's optimiser does not send it either. This route makes the
 * only request AIC accepts, then serves the bytes from our origin. The IDs and
 * widths are a closed set, so it cannot be used as an open proxy.
 *
 * These images never change for an id, so the response is immutable for a year.
 */

const AIC_IMAGE_BASE = "https://www.artic.edu/iiif/2";
const IMAGE_ID = /^[a-zA-Z0-9-]{6,80}$/;
const WIDTHS = new Set([843, 1686]);
const FALLBACK_WIDTH = 843;
const TIMEOUT_MS = 15_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await context.params;

  if (!IMAGE_ID.test(imageId)) {
    return new Response("Unknown painting image", { status: 404 });
  }

  const widthParam = new URL(request.url).searchParams.get("width");
  const width = widthParam === null ? FALLBACK_WIDTH : Number(widthParam);

  if (!WIDTHS.has(width)) {
    return new Response("Unsupported image width", { status: 404 });
  }

  try {
    const upstream = await fetch(
      `${AIC_IMAGE_BASE}/${imageId}/full/${width},/0/default.jpg`,
      {
        headers: {
          "AIC-User-Agent": AIC_USER_AGENT,
          Accept: "image/jpeg",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!upstream.ok || !upstream.body) {
      return new Response("Painting image unavailable", { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("Painting image unavailable", { status: 502 });
  }
}
