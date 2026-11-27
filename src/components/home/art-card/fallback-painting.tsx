"use client";

import { useId } from "react";

/**
 * The bundled stand-in for the rare failed AIC request: a small abstract
 * landscape painted in SVG, so the frame is never empty and no fallback image
 * costs a second request. The palette is deliberately quieter than a real
 * painting so it cannot be mistaken for the day's pick.
 */
export function FallbackPainting() {
  const id = useId().replace(/:/g, "");
  const sky = `fallback-sky-${id}`;
  const water = `fallback-water-${id}`;

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8c7a3" />
          <stop offset="0.62" stopColor="#c9b78f" />
          <stop offset="1" stopColor="#b9a77e" />
        </linearGradient>
        <linearGradient id={water} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f8d7c" />
          <stop offset="1" stopColor="#5d6c61" />
        </linearGradient>
      </defs>

      <rect width="400" height="300" fill={`url(#${sky})`} />
      <circle cx="292" cy="78" r="31" fill="#edd9a7" opacity="0.9" />
      <circle cx="292" cy="78" r="43" fill="#edd9a7" opacity="0.18" />

      <path
        d="M0 168 C 52 138 96 144 136 158 C 184 175 218 142 262 148 C 310 154 350 136 400 156 L400 208 L0 208 Z"
        fill="#8d9478"
        opacity="0.9"
      />
      <path
        d="M0 190 C 64 172 104 184 154 190 C 214 197 264 176 314 184 C 350 190 374 184 400 178 L400 228 L0 228 Z"
        fill="#6f7a63"
      />
      <rect y="216" width="400" height="84" fill={`url(#${water})`} />
      <path
        d="M38 232 H 210 M 92 246 H 322 M 24 262 H 176 M 236 274 H 380"
        stroke="#c8c6a4"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.28"
      />
      <path
        d="M34 228 C 28 196 32 174 46 158 C 36 180 42 204 52 228 Z"
        fill="#3f4a3b"
        opacity="0.85"
      />
      <path
        d="M52 228 C 58 198 56 182 68 168 C 62 190 66 208 64 228 Z"
        fill="#4a5544"
        opacity="0.7"
      />
      <rect
        width="400"
        height="300"
        fill="none"
        stroke="#000"
        strokeOpacity="0.08"
        strokeWidth="8"
      />
    </svg>
  );
}
