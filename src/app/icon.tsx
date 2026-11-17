import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Monogram on the Day primary (blue-750, #3687d9) with --on-primary
 * (neutral-50, #ffffff), both from globals.css. /favicon.ico is the same
 * artwork rendered once and committed, since the convention only serves this
 * route at /icon.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          background: "#3687d9",
          color: "#ffffff",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        P
      </div>
    ),
    size,
  );
}
