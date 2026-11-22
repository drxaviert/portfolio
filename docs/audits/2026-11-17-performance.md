# Performance audit — 2026-11-17

Worktree `drxaviert/audit-performance` @ e590d04. Audit only; no code changes left behind.
Method: `pnpm build` (Next 16.4.5 / Turbopack, Cache Components) then `pnpm start -p 3112`.
Next 16's Turbopack build prints no per-route size column, so route sizes are computed from each
route's served HTML script list + the on-disk chunks (gzip -9); chunks only in the RSC payload are
counted as lazy. Lighthouse 12 headless via `CHROME_PATH` = Playwright Chromium 1255 (Chrome **was**
available). Mobile = LH default emulation (4× CPU, Slow 4G); desktop = `--preset=desktop`.
Runtime checks: Playwright + CDP (4× CPU, 1.6 Mbps / 150 ms RTT), paint sampling (clip screenshots
decoded in a canvas) to time the first legible paint of the LCP text, and CDP profiler traces.

## Baseline

| Route | First-load JS | CSS | +after idle | LH mobile | LH desktop |
| --- | --- | --- | --- | --- | --- |
| `/` | 208k gz | 19k gz | +55k JS / +5k CSS | 70 / 74 / 77 (3 runs) | 99 |
| `/work/systems-in-motion` (direct) | 246k gz | 24k gz | — | 57 | 75 |
| `/nope-404` | 186k gz | 11k gz | — | — | — |

LH mobile `/`: FCP 1.4s, LCP 3.7–3.8s, TBT 490–790ms, CLS 0. `/work`: FCP 1.4s, LCP 4.4s, TBT 1.59s, CLS 0.
Desktop: FCP 0.3s, LCP 0.8–1.0s, TBT 100/580ms. Sizes are sane for a Next app; **no three.js leak** —
the 530k raw / 130k gz three chunk is only reachable from `/dev/play-card`, which 404s in production,
and Motion (22.6k gz) appears only on `/work` first load. Observed (not simulated) TBT under 4× CPU +
Slow 4G was 130ms on `/` and 205ms on `/work`: LH's TBT is lantern-modelled, so treat it as a ranking
signal, not a measurement.

## Findings

### F1 · High · LCP is held at opacity 0 by the entrance animations — VISIBLE fix

- `src/components/home/home-entrance.css:278-289` (`from { opacity: 0; filter: blur(8px) }`), delay
  `250ms + 60ms × item`, duration `1100ms` (`:220-226`); veil clears at 1400ms (`:52`).
- `src/components/work/entrance.css:83-93` + `:118-128`: every reader block animates opacity 0 →
  1 with a 320–480ms delay, 800ms long.
- Evidence: LH reports LCP render delay = 3310ms of 3760ms on `/` (88%) and 3991ms of 4444ms on
  `/work` (90%); both LCP elements are inside these animated subtrees (featured `<h1>`, first `.wd-p`).
  Paint sampling at 375px, 4× CPU, Slow 4G: the card title is first legible at **1561ms**, vs **1076ms**
  with `[data-entrance] * { animation: none }` and 1086ms with reduced motion (+485ms). `/work`'s first
  paragraph: **1577ms** vs **1121ms** without the reader entrance (+456ms).
- Fix (smallest): exempt the first-viewport LCP block from the delay — start the featured title / first
  paragraph at delay 0 with opacity 1, keeping the rise and blur on the rest. Changes the opening beat.

### F2 · Med · Every ambient loop keeps running behind the open reader — INVISIBLE fix

- `src/components/horizon/horizon-shader.tsx:857-868` stops the rAF loop only for `document.hidden`
  or reduced motion; `src/components/faux-ui/use-scene-pause.ts:24-29` pauses only offscreen/hidden;
  nothing pauses for "covered".
- Evidence: direct `/work/systems-in-motion` load with the drawer open — **22 running CSS animations**
  (`horizon-drift-a/b`, `horizon-breathe`, `horizon-intensity` ×2, `fu-bar-sample` …) and WebGL at
  **61 drawArrays/s** over a 2s window. The panel covers **100%** of 390×844 and **94%** of 1440×900
  (`wd-reader-panel` 1408×868, opaque `#fff`); the canvas is 585×1266 at dpr 3 (cap 1.5).
- Fix: pause on `OVERLAY_OPENED_EVENT` (already dispatched), resume on `OVERLAY_CLOSING_EVENT`/exit;
  set the same `data-paused` the scene hook already understands. Nothing visible on mobile; on desktop
  only a flat 16px dim gutter would hold still.

### F3 · Low · `/` downloads the reader and Motion ~75ms after load — INVISIBLE fix

- `src/components/work/warm-reader.tsx:13-19,25-42` (rendered at `home-screen.tsx:39`) imports
  `expand-shell` (→ `motion/react`), `reader-rail`, `scroll-ruler` on `requestIdleCallback`.
- Evidence: on `/` at 390px, **8 JS + 3 CSS requests fire 72–80ms after `load`**, **+57.5k gz**, led by
  Motion `07hk7yopmmp4s.js` at 22.6k gz. A visitor who never opens a card still pays it; it partly
  undoes the deliberate "keep motion out of the home route".
- Fix: warm on `pointerenter`/`focus` of a work card, or gate the idle warm on
  `navigator.connection.saveData`/`effectiveType`. Costs ~27ms on first open at 4× CPU, which is the
  trade-off the file documents.

### F4 · Low · Nav dock lands 7px low on every hard load of `/` — INVISIBLE fix

- `src/components/nav/nav-dock.tsx:175` measures `[data-nav-slot]` with `getBoundingClientRect()` while
  the slot is mid-entrance (`home-entrance.css:281`, `translate: 0 7px`), then writes that as `top`.
- Evidence at 1440×900: slot rect 783 at hydration → dock `top: 783px`; slot settles at **776**, so the
  dock stays 7px low for the session. Recorded as a layout shift (0.0003, `wd-nav-dock` 776 → 783).
  Re-aligns only on resize or a nav flight home.
- Fix: read `offsetTop` (transform-independent) or skip the correction until `data-entrance-played`.

### F5 · Low · 8 render-blocking CSS files on `/`, 11 on `/work` — INVISIBLE fix

- 18 separate `import "./*.css"` statements (`home-layout.tsx:14`, `home-screen.tsx:5`,
  `home-cards.tsx:8`, `nav-dock.tsx:28`, `cover.tsx:14`, `reader.tsx:15-17`, …) emit **12 CSS chunks**.
- Evidence: LH `render-blocking-resources` lists 8 files on `/`, est. 600ms; CSS is only 19k gz, so the
  cost is round trips, not bytes (FCP 1.4s with TTFB 0.45s on mobile).
- Fix: consolidate component styles into one (or two) entry stylesheet imported from the layout.

### F6 · Low · Permanent `will-change: transform` on the four spotlight pools — INVISIBLE fix

- `src/components/home/frame-line-spotlight.css:98`. Four layers stay promoted for the life of the
  page although they only move under the pointer; the skill's "targeted fix, not seasoning" rule.
- Fix: move the hint to the pointer-active/hover state (the rings already do this).

### F7 · Low · Canvas-blur probe forces a GPU readback at startup — INVISIBLE fix

- `src/components/horizon/horizon-shader.tsx:469-499`; `getImageData` at `:491` on a 32×32 canvas.
- Evidence: headless Chromium logs `GL Driver Message … GPU stall due to ReadPixels` during load;
  the call measures 0.6ms unthrottled, and it runs before the first shader frame.
- Fix: keep the probe (Safari needs it) but run it after first paint, or reuse a 1×1 canvas.

## Needs a real device / human

- iOS Safari: the Horizon CSS fallback blurs a 180px ellipse (×0.45 ≈ 81px) and
  `entrance-soft-glow` animates a parent filter over it for 1400ms — the "no blur >20px on an animating
  element" case. Unmeasurable here; check entrance smoothness and battery on an iPhone.
- Carousel hover peek (`hover-peek-dom.ts`): WAAPI animating the registered `--car-x` length is
  main-thread style work. Verify scrub smoothness on a mid-range Android.
- Thermal/battery for F2 on a phone (full-screen fragment shader while reading).
- Whether shortening the entrance (F1) is acceptable — motion is an owner call (kept 2026-11-13).
- Field data (CrUX/real 4G) to replace LH's simulated TBT.

## Checked and fine

- No `transition: all` / bare Tailwind `transition` anywhere in `src`; no `@keyframes` animating
  `height/width/top/left/margin/padding` (parsed every stylesheet).
- three.js absent from `/`, `/work`, 404; Motion absent from `/` first load; `/` prefetches the three
  studies' RSC for ~10k total (partial prefetching working).
- WebGL: DPR cap 1.5 (585×1266 at dpr 3); 0 draws/s with reduced motion and in a background tab;
  context loss falls back to the CSS layer; buffer/program/shaders/texture deleted on unmount; tokens
  read on mutation only (no per-frame `getComputedStyle`); `resize()` uses ResizeObserver-cached sizes.
- No per-frame React state: carousel, scroll ruler, ring glow and shader all drive frames through refs,
  WAAPI or direct DOM writes; one state change per section crossing / step.
- Fonts: one self-hosted Work Sans woff2 via `next/font`, preloaded (`:HL … "font"`), `display: swap`;
  no FOUT shift observed.
- No `<img>`/`next/image` anywhere — covers are CSS scenes; the OG PNG (290KB) is metadata-only.
- Theme switch is one view transition crossfade; no per-element colour transitions.
- CLS 0.000 at 375/390/1440 on `/`, `/work`, 404 apart from F4's 7px dock jump; `ScrollRuler`'s
  empty-then-measure mount causes no shift.
- `/robots.txt`, `/sitemap.xml`, `/opengraph-image.png` 200; `/work` → 308 `/`; `/dev/*` 404 in prod by
  design.

Not reported by design: hover ring without click, shadow-not-border cards, the dim tracker palette,
Figma resting geometry, and the kept motion itself (only its measured load cost is in F1).

## Follow-up 2026-11-21 · hover ring: don't trade the 1px edge for paint

The 2026-11-16 perf pass (`7fcb219`) moved the featured card's hover ring from an animated `clip-path` to
`transform: scale` to avoid repainting the glow layer. Both techniques antialias the edge at fractional
positions, so the 1px ring smeared across 2 device pixels mid-grow and then "thinned" when the 800ms grow
ended. That happened on every ring host, not just the featured one. PR #94 switched every host to animating
layout `inset`, which snaps edges to whole pixels. The cost was measured in headless Chromium: ~1ms layout
per hover, and featured-card raster about 2–3× higher.

**For future audits:** treat that cost as accepted. Don't revert to `scale`/`clip-path`. Any cheaper
approach must keep the edge exactly 1 device pixel on every frame (sample the top edge at 100/200/400/800ms,
day and night, DSF 1 and 2). Still open: a real-GPU Chrome trace for dropped frames. Details are in
`docs/design-system/motion.md` → "Home card hover ring".
