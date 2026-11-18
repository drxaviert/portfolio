# Drawer open: moveNav relayout + content-visibility + focus/iPhone checks (handoff, 2026-11-18)

## Goal
Part A (checks, no code unless bug): A1 Escape/Back/"← Work" focus return to the source card link (keyboard and mouse open, headed Chrome via Playwright channel "chrome"; review PR #48 fix/drawer-focus-return). A2 iPhone 15 WebKit: blur-stack backdrop-filter and blur entrance render, no console errors, max 2 screenshots (describe, don't return).
Part B (approved perf): B1 moveNav forced relayout (~15ms) on open; B2 content-visibility on off-screen reader sections. Measure interleaved, >=3 runs each, pixel parity (paused seeked frames, DPR 1), pnpm test/typecheck/lint. One commit per item, body with what/why/root cause/numbers, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Merge PR only if no visual change.

## State
- Worktree: C:\Users\Dat\orca\portfolio\.claude\worktrees\agent-aac75dba60c205050, branch `perf/drawer-open-relayout` (off main 1231414). `pnpm install` done. No code changes. Dev server NOT started (`pnpm dev:log` with port 3141; check package.json for passing the port; never pipe plain next dev; never `next build` here).
- Nothing in Part A or B has been run yet.

## Findings from docs/handoffs/2026-11-17-drawer-first-render.md
- v6 already fixed focus return: `returnTarget` uses `cardElement(slug)` in src/components/work/use-morph.ts (laid-out card copy, not the 0x0 carousel copy). Verify it still holds (A1) for Back and "← Work".
- moveNav: src/components/nav/nav-flight.ts:83; called from use-morph.ts:221 (fade), :249 (flip on open), :301 (close). Audit: a `getBoundingClientRect` after its own style writes forces a ~17ms relayout (4x CPU). Values must stay identical; fix = batch reads before writes or reuse a measurement.
- content-visibility (audit item 4): below-fold reader prose. Risk: ScrollRuler `measure()` (src/components/work/scroll-ruler.tsx ~l.288) reads every block's rect/scrollHeight, so placeholder sizes could shift the ruler/scrollbar; findCard getClientRects (~110ms) is the article's first layout. Use contain-intrinsic-size; drop it if no measurable gain or any visible change.
- Old tools (open-trace.cjs, analyze.cjs, post.cjs, pw-focus.cjs) are in earlier scratchpads under C:\Users\Dat\AppData\Local\Temp\claude\f335a9668ad87a5c\*\scratchpad\ and may still exist; otherwise rewrite with Playwright + CDP tracing (4x CPU, prod build from a copy outside the worktree).

## Next steps
1. Start dev server on :3141; A1 with Playwright headed Chrome (keyboard Enter, click, Escape, Back, "← Work"; assert document.activeElement is the card link).
2. A2 with webkit `devices["iPhone 15"]`; read computed backdrop-filter/-webkit-backdrop-filter on blur-stack and entrance elements; collect console errors.
3. B1: trace, locate forced layout in nav-flight.ts, smallest fix, interleaved A/B x3+, pixel parity.
4. B2: content-visibility + contain-intrinsic-size in reader.css, measure, check ScrollRuler/morph/find-in-page/focus return, else drop.
5. pnpm test, typecheck, lint; commits; push; PR; merge only if all verified; stop dev server.

## Gotchas
- Windows + Git Bash; no sleep chains; host speed drifts so interleave runs.
- Do not delete branches/files/worktrees.
