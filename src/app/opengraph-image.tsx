import { ImageResponse } from "next/og";

export const alt = "Portfolio — design engineer portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * A typographic card in the Day palette from globals.css: --surface
 * (neutral-200), --on-surface (neutral-700) and --on-surface-variant
 * (neutral-450). No artwork and no gradient, so it stays the site's own
 * surface. Work Sans is loaded through next/font at build time, not as a file
 * this route can read, so the default sans is used.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 28,
          padding: "88px",
          background: "#e5e5e5",
          color: "#0d0d0d",
        }}
      >
        <div
          style={{
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: "0.16em",
            color: "#4c4c4c",
          }}
        >
          DESIGN ENGINEER
        </div>
        <div
          style={{
            fontSize: 128,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          Portfolio
        </div>
      </div>
    ),
    size,
  );
}
