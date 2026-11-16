# Handoff: work drawer BUILD, lead session 6 (2026-11-14)

**Role:** Opus lead for the Work drawer build. Process as in `2026-11-14-work-drawer-t9.md` / `-build.md`; ledger `.superpowers/sdd/2026-11-13-work-drawer/progress.md`. Hands-on work goes to the DeepSeek worker (terminal `structworker_0f0ab39f…`, opencode-go/deepseek-v4.1-flash), reached with `orca orchestration send --to dispatch:<latest dispatchId>`.

## Done this session (all on drxaviert/work-drawer, gates green each time)
- T10 `de96bc8`: cover now shares the column's edges; "← Work" rail is level with the cover top (cause: 32px inset in the 753x416 cover scene).
- T11 `61ac7c2` + `d65aab6`: Dat picked entrance **A (cascade)**; title is the cascade's first step; b/c and the `?entrance` switch removed.
- T12 `6327040`: Dat dropped the title morph (card title flying into the drawer). The drawer title is its own element in the cascade. Open = panel FLIP + nav dock + backdrop + cascade only.
- T13 `4a1a5b2`: "not smooth" was choreography, not dropped frames (p95 6.2ms, no long tasks). It is now a wave starting after the panel lands: title 12px/320ms on the panel curve, meta 8px, body 6px at 280ms on a gentler ease-out, gaps 0/60/105/140/165ms, 5 groups, cover fades only, 445ms window. Also fixed a StrictMode timer bug. Report `t13-report.md`.

## Update
- T14 DONE `b043a4d` (219 tests green, 1x p95 6.2ms; starts cover 403 / title 500 / … / p3+ 900ms from click). Report `t14-report.md`, stills `t14-shots`. Dat's :3002 crashed (Turbopack WorkerError); he must restart it before comparing. Next = step 1 below with Dat.

- Dat picked BLUR; wants smoother + rhythm. **T15** in flight (dispatch `ctx_b9502a6bd445`, brief `t15-blur-rhythm.md` → `t15-report.md`): reading order, even 80ms beat, 800ms ease-out-quint, blur 8px/10px rise, blur becomes the only entrance (switch + T13 rules removed). After it: Dat checks on :3002 (lead restarted it in bg; dies after ~2h).

- T15 DONE `80b3b4e`: blur is the only entrance; starts 405/484/563/641/720/805/884ms from click, 800ms cubic-bezier(0.22,1,0.36,1), opacity 0 + blur(8px) + 10px (cover: no blur); reduced 120ms opacity. 216 tests green. Waiting on Dat's feel check, then motion approval → motion.md → worker_done to coordinator.

- T16 audit (`t16-motion-audit.md`): 0C/2I. Blur is not clipped; the cascade is in order on an even 80ms beat. I1 = blur unproven on a real iPhone → Dat to test on device. I2 = study→study bare-panel blink → T17 fix sent (`t17-report.md`). The audit has a motion spec table ready for motion.md.

- T17 DONE `2f15395`: study→study = 140ms content-out, route pushed at 35%, incoming entrance starts 120ms in (`--wd-beat-lead: -120ms`); no frame with no visible content; 225 tests green. Left: Dat's iPhone check + motion approval → motion.md (spec table in t16 audit) → worker_done to coordinator.

## In flight (was)
- **T14** (dispatch `ctx_44a61e32c8f2`, brief `t14-blur-variant.md`, report → `t14-report.md`): temporary `?entrance=blur` variant modelled on dannyjpwilliams.com/about. That page uses blur(6px) + 8px rise + opacity, 700ms, cubic-bezier(0.165,0.84,0.44,1), blocks 100ms apart, items in a group 45ms apart. No blur on the cover. Default with no query = T13.

## Next
1. When T14 reports: check the report, then send Dat http://192.168.2.33:3002/ vs http://192.168.2.33:3002/?entrance=blur (click the featured card), plus localhost.
2. Dat picks one → worker removes the switch (or makes blur the default).
3. Still open with Dat: approve all motion values; keep or drop the uncommitted `src/app/dev/proto/cover-title/`.
4. On approval: log motion in `docs/design-system/motion.md` (T13 timeline table, panel/nav/backdrop values from the t9 handoff), then `worker_done` to the coordinator (task `task_a05581562ca2`, dispatch `ctx_10599d77ad9d`). No PR or merge from this lead.

## Gotchas
- Dat runs :3002 himself (`pnpm exec next dev -p 3002 -H 0.0.0.0`); the worker uses :3003 and a temporary NEXT_DIST_DIR.
- A `send` to a worker that is mid-turn is not always picked up as a new task. Re-send after its `worker_done` if `worker-list` shows no new dispatch.
- The reference page is open in Orca browser tab `517806b1-…` (worktree work-drawer).
