# Drawer open: moveNav relayout + content-visibility + focus/iPhone checks (handoff, 2026-11-18)

## Goal
Part A (checks, no code unless a bug): A1 focus returns to the source card link for keyboard and mouse opens, closed by Escape, browser Back and "← Work". A2 iPhone 15 WebKit: blur stack and entrance blur render, no console errors. Part B (perf): B1 the moveNav forced relayout on open; B2 content-visibility on off-screen reader prose. Interleaved A/B, >=3 runs, pixel parity, test/typecheck/lint. One commit per item, PR to main, merge only if nothing visible changes.

## State
- Worktree `C:\Users\Dat\orca\portfolio\.claude\worktrees\agent-aac75dba60c205050`, branch `perf/drawer-open-relayout` (off main 1231414). Tree clean, no code changes. Dev server and the two prod copies' servers are stopped.
- A1 pass, A2 pass, B1 measured with no measurable gain (no code shipped), B2 dropped (visible change). All three checks pass: `pnpm test` 45 files / 528 tests, `pnpm typecheck`, `pnpm lint`.

## A1 — focus return (pass, no code change)
- Playwright, headed Chrome (`channel: "chrome"`), 1280x900. All six paths return focus to the laid-out card link (`a[data-work-card=systems-in-motion]`, the 753x416 carousel copy): keyboard Enter and click, each closed by Escape, `page.goBack()` and the "← Work" rail link. `document.activeElement` is that link after the route is back on `/`.
- The reader's title focus on open and the focus trap are unchanged. No code change.

## A2 — iPhone 15 WebKit (pass, no code change)
- Playwright `webkit` + `devices["iPhone 15"]` (393x659, DPR 3). `CSS.supports("backdrop-filter")` and `-webkit-backdrop-filter` are both true. Six `.wd-blur-band` elements compute `backdrop-filter` and `-webkit-backdrop-filter` = blur(1/2/4/8/16/32px) with their gradient masks; the 393x80 stack is visible at z-index 1.
- Entrance: body blocks compute `filter: blur(7.6-10px)` while `wd-enter-defocus` runs and `none` at rest; the scroll column is opacity 1.
- Console: one error, the pre-existing dev-only Next warning `Route "/(.)work/[slug]": URL data during prerendering/navigation ... instant-shell-url-data`. It appears on the home page in Chrome too, not iPhone-specific. Open item, unrelated to rendering.
- Two screenshots only (`a2-open.png`, `a2-scrolled.png` in the scratch dir): at rest the nav row sits over the cover; scrolled 600px, the line above the bar is visibly more blurred than the one below it — the progressive stack works.

## B1 — moveNav forced relayout: real but not waste (no change shipped)
- The read is in `fly()` (`src/components/nav/nav-dock.tsx:136`), the dock side of `moveNav` (`nav-flight.ts:83` is only the bridge): after `dataset.navState`/`top`/`transform` writes it calls `getBoundingClientRect()` to get the new box top. Instrumented at 4x CPU, that read is 7-9ms (one outlier 11.5ms; the read before the writes, in the old state, is 0.1-1.5ms). The CDP trace shows a partial `Layout` of 14 elements (~6ms) plus `UpdateLayoutTree` (~4ms).
- Fix tried (`reuse a measurement`): read the drawer's top from the root tokens before the state switch — `--wd-panel-inset` + `--wd-nav-inset`, which is exactly `nav-dock.css`'s reader `top` — instead of reading layout after it. Verified equal to the measured top at 1440/1024/393 (delta 0.000). Flight values are bit-identical (dock matrix `732` / `161.676` / `5.60074` / `0.000297` at 0/120/360/900ms) and mid-morph screenshots differ by at most 1/255 on 0.09% of pixels.
- A/B, 13 interleaved runs each, prod `next build --webpack` from copies outside the worktree, 4x CPU: pointerdown -> panel mounted median 269.8ms before vs 264.6ms after (noise); pointerdown -> phase `open` 901 vs 876ms; `Performance.getMetrics` layout duration median 23.5ms in both, `LayoutCount` 7-9 in both, style duration and task duration unchanged.
- Root cause of the non-result: the first painted frame needs the nav's new box anyway, so removing the read only moves that layout from JS into the frame. Not shipped: the token read adds a CSS-to-JS coupling (guarded by a CSS test) for no measurable win. Revisit only if the nav stops moving position on open (e.g. a composited-only flight), which is a motion change and needs Dat.

## B2 — content-visibility on reader prose: dropped (visible change)
- Injected `.wd-prose > * { content-visibility: auto; contain-intrinsic-size: auto 100px }` on a settled reader: `scrollHeight` 2943 -> 2919 at the top (max scroll 2075 -> 2051); scrolling to the bottom renders the skipped blocks and it grows back to 2943/2075, so the scroll range changes under the user. The ruler measures every prose block in `ScrollRuler.measure()`, so its block offsets are taken from 100px placeholders, and its tick geometry is computed against the wrong max.
- Dropped per the brief (any visible change), no code written.

## Tools
- Scratch scripts live in the worktree's ignored `.next/scratch` (`a1-focus.mjs`, `a2-iphone.mjs`, `b1-instrument.mjs`, `b1-trace.mjs`, `b1-token-check.mjs`, `b2-inject.mjs`, `b2-remeasure.mjs`, `b2-jump.mjs`, `ab.mjs`, `ab-layout.mjs`, `parity2.mjs`, `pngdiff.mjs`).
- Prod copies for the A/B: `C:\Users\Dat\AppData\Local\Temp\opencode\drawer-open\{base,fix}`, built with `next build --webpack` (Turbopack refuses a junctioned `node_modules` in a copy). Both servers stopped; directories left in place.
