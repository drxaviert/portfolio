# Handoff: work-drawer follow-ups lead (2026-11-15)

**Role:** Opus LEAD, kept open, for coordinator task `task_a7084fae0fe4` (dispatch `ctx_7a3c6613b04b`, coordinator `orca_session_id:claude_f568d03b_f4f9_4cfe_8c2f_fa710a0a0e00`). My session id: `orca_session_id:f05171cb-bfe4-45b8-99fc-48982226ad7e`. Branch `drxaviert/drawer-followups`, nothing pushed yet.
**Worker:** DeepSeek OpenCode (`opencode-go/deepseek-v4.1-flash`), terminal `structworker_6c894ea3…`. Latest dispatch `ctx_b4a5df1534fc`. Reach it with `orca orchestration send --to dispatch:<latest> …`. Its reports are in `.superpowers/drawer-followups/item1*-report.md`.

## Item 1: reader stuck after a direct load (commits in order, all reviewed)
- `e60af47`: close used router.back() whenever history had the workOverlay marker. From a directly loaded study, Back landed on the first study. Now it goes back only when no rendered page-mode reader is behind the drawer, and pushes '/' otherwise.
- `5d5e546`: closes with no card to fly into run the existing close gesture (opacity + 10px drop, MORPH_CLOSE_S, easeIn; nav flies home). Reader behind is hidden via `data-behind-exit`. New `page-reader-shell.tsx` gives directly loaded readers the same exit (rail, mobile action, nav Work/Home). Dat said "go" on option A.
- `1be2567`: home intro replayed after a client arrival at '/', so home was blank for ~1.5s. Now skipped on client arrival (first load still plays it), and '/' is prefetched from the reader. Dat said "yes" to A + C.
- `682f432`: close waited on the animation's promise before router.push. With rAF paused or throttled (occluded window, background tab, WebKit low power), it never pushed and the reader stayed at opacity 0. Now `landWithin()` (morph.ts) caps the wait at the flight duration. 308 tests, typecheck and lint green.
- `5ff79b5`: data-entrance-played set on <html> before router.push("/"), so home renders settled from its first frame. Dat saw content pop in ~1s late in dev because dev never prefetches. Prod build on :3016 (throwaway copy in %TEMP%\opencode\prod-3016, detached): 351ms Chrome / 749ms WebKit, no blank frames.
- `f91c309`: the card-less exit now scales to CLOSE_SCALE 0.95 around the panel's visible centre (it no longer drops 10px), on MORPH_CLOSE_S, easeIn. Prod :3016 rebuilt from %TEMP%\opencode\prod-3016b.
- `3414edd`: a direct load renders HomeScreen plus the overlay reader, already open with no opening animation. Close takes the normal overlay path: FLIP into the card, or the 0.95 scale-out when there is no card. Close then does replace("/"). Removed PageReaderShell, page mode and pageReaderBehind. 300 tests green.
- **Open:** Dat to confirm on :3016 (prod, rebuilt from 3414edd). Latest worker dispatch `ctx_df17cbe3df98`.
- Known, untouched: stale 0x0 @modal node after browser Back. Pressing Back mid-close leaves the nav in home state (rare). Dev-only warning: /work/[slug] reads params outside Suspense (page.tsx:20).

## Items 2–4: waiting on Dat
2. /work 404: proposed A = permanent redirect /work → / (recommended), B = real index page. No pick yet.
3. iPhone blur check: checklist was sent (backdrop blur on open/close, text blur-in, nav dock frosting over scroll + safe areas, Night mode). No report yet.
4. Delete `src/app/dev/proto/work-drawer/`? No yes yet; do not delete without one.

## Gotchas
- Dev server :3006 runs detached (hidden cmd, output to `dev-3006.log` in the repo root, untracked; never commit it). A worker-started `next dev` hung once when its shell exited. Restart: `taskkill` the PID on :3006, then a `Start-Process` hidden `pnpm exec next dev -p 3006 -H 0.0.0.0 > dev-3006.log 2>&1`.
- Git Bash mangles "/" in curl paths; use `MSYS_NO_PATHCONV=1`. The guard hook blocks `rm`; write temp files to the scratchpad instead.
- Links for Dat: always both http://localhost:3006 and http://192.168.2.33:3006.

## Next
1. Dat retests item 1 → fix whatever is left via the worker.
2. Get Dat's picks for items 2/4 and the iPhone results → worker implements.
3. On approval: PR → merge → push to main (no extra ask), then worker_done to the coordinator with the PR number, merge commit, changes and anything still open.
