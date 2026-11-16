# Handoff — home carousel lead (2026-11-15)

Goal: Stepped endless carousel for the homepage MIDDLE row (Project + 3 slivers). Orca task_4a2ff415bc35, dispatch ctx_e298a4a6ef8e, coordinator orca_session_id:claude_f568d03b_f4f9_4cfe_8c2f_fa710a0a0e00, my session orca_session_id:b7833b22-7315-49a2-a11e-f8c94f53e7b1. Do NOT push or merge.

## Decided with Dat
- Items: the 3 works from listWork() plus an inert "More work soon" placeholder. Generic over n (tests cover n=4 and n=6).
- Click a non-first card to step it to the front; click the first card to open its drawer (the placeholder is inert). ←/→ step. No buttons, no idle motion.
- Geometry: translate plus clip-path crop via registered --car-x/--car-r on ONE main-thread WAAPI animation (fixes a gap bug where the compositor transform and the main-thread clip were a frame apart).
- Step: 900ms cubic-bezier(0.5,0,0.1,1) (expo felt "too abrupt"). Retarget uses quint-out.
- Right edge: no peek. Left hover peek = the row shifts one column right; the previous item (a blurred 4px copy, left alpha mask) enters at the last-slot width, and the 4th card exits right. 450/350ms cubic-bezier(0.22,1,0.36,1). Click on the peek steps back.
- Featured click: freeze the row at its drawn pose; the morph measures that; the row retracts on wd:overlay-opened / wd:overlay-closing.
- Phone (<md): unchanged stack.

## State
- Branch drxaviert/home-carousel. Last verified commit aea63af (295 tests). Code is in src/components/home/carousel/, plus hooks in use-morph.ts, overlay-exit.ts and ring-pointer.tsx.
- QA (headed Chrome, independent): all scenarios PASS at aea63af. Logs are in the session scratchpad qa/run4.
- DONE: the audit fixes are in 7 commits (0fabe59 blur 2.5px + will-change, 1ee9e05 tuner "responsive" preset, fc08190 aria-live for pointer steps only, a6f8b1a reduced motion 0.6→1 on changed slots only, 31fa15f ring glow follows steps via step-events.ts, c78c9de cached hover-zone rect, 9259df3 release held motion on popstate or after a 1.5s grace). 309 tests pass.
- Long-frame counts: edge blur is indistinguishable from none (both noise-level in headless Chrome). Open items: a frozen STEP snaps on a hard back (only the peek animates); the real drawer open/close was not re-run after these commits, so re-run QA scenario f once.
- Dev server: `PORT=3005 pnpm dev:log`. If /work/* returns 500 (MDX worker EPIPE), kill the :3005 PID and restart.

## Next
1. Review the worker's audit-fix commits (typecheck/lint/test, frame numbers); re-run QA if motion changed.
2. Dat picks ?sliver= (crop|grey|tint), ?blur= (edge|motion|none), the step curve (default vs responsive), and pastes Copy values from ?tune=1.
3. Remove the switches, the tuner, sliver-mode.ts and blur-mode.ts plus their tests; log the final values in docs/design-system/motion.md.
4. Move the stale docs/handoffs/2026-11-15-home-carousel-edge-fix.md to quarantine (not delete) unless Dat says delete.
5. Send worker_done (branch, commits, port, evidence). Share both localhost:3005 and 192.168.2.33:3005.

## Gotchas
- `pnpm format` = prettier --write on the whole repo. Never run it.
- Agents hit their context limits; pass them handoffs rather than long histories.
