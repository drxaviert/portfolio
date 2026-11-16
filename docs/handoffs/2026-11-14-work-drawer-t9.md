# Handoff: work drawer BUILD, lead session 5 (2026-11-14)

**Role:** Opus lead for the Work drawer build. Process unchanged (see `2026-11-14-work-drawer-build.md`); ledger `.superpowers/sdd/2026-11-13-work-drawer/progress.md` = source of truth. Reviews and fixes run on DeepSeek workers (`--agent opencode --model opencode-go/deepseek-v4.1-flash`).

## Done this session
- T8 fix round `c36f3fd` (F1,F2,F3,F5,F6) → re-review ✅ 0C/0I/5M.
- Final whole-branch review (`final-review.md`): 3 Important → fix wave `31c6eb8` (focus containment + inert `body>main`, rail z-index, no study→study flash, M1) → re-review ✅ 0C/0I/6M (`final-fix-review.md`). 34 ledger minors parked with reasons.
- Pinned motion: backdrop in 320ms ease-out, backdrop out 240ms ease-in, content fade-out 140ms ease-in, reduced = 120ms ease-out opacity-only.
- Dat tested on dev server :3002 (started by lead, `pnpm exec next dev -p 3002 -H 0.0.0.0 > .next/dev-server.log`; `pnpm dev:log -- -p` does NOT pass args). Real slugs: `systems-in-motion`, `title-sequence`, `type-in-motion` (not the dev-proto slugs).

## In flight
- **T9 = Dat's design feedback**, worker `ctx_38905721fc84`, brief `.superpowers/sdd/2026-11-13-work-drawer/t9-dat-feedback.md`, report → `t9-report.md`. Three commits:
  - A. "← Work" sticky at top near the nav, follows scroll (desktop).
  - B. 3 content entrance variants, switch `?entrance=a|b|c` (a cascade, b title-led, c soft reveal); Dat picks, then remove the switch.
  - C. ONE persistent nav in root layout that FLIPs from home position into the drawer (480ms cubic-bezier(0.32,0.72,0,1) open / 300ms ease-in close, no move study→study); delete the duplicate ReaderNavSlot instance. Ruling (lead) logged in ledger.
  - Worker uses its own server on :3003; :3002 belongs to Dat.

## Update
- T9 DONE: `b423123` (A), `bbd36ee` (B), `c158324` (C); 215 tests + build green; report `t9-report.md`. Scoped review dispatched (`t9-review-dispatch.md` → `t9-review.md`). Step 1 below is in flight; then step 2.
- T9 review: 0C/2I/6M (`t9-review.md`): no-card close focus → body; nav outside aria-modal. Fix wave sent to T9 worker `ctx_38905721fc84` (one commit). After it: no further fix wave; show Dat.
- Fix wave DONE `df69c20` (HEAD): focus return 12/12, parity 16/16, gates green; t9 minors 3-8 parked. Steps 1-2 done; waiting on Dat for entrance pick (a/b/c), motion approval, cover-title keep/drop. Then remove `?entrance` switch (DeepSeek), step 4.

## Next
1. (in flight) When T9 reports: DeepSeek scoped review of 31c6eb8..HEAD (focus on C: same DOM node, inert/focus-trap, nav parity, tooltips in panel; and B reduced-motion/interruptibility). One fix wave max.
2. Show Dat (localhost + http://192.168.2.33:3002, e.g. `/` then click featured card; `?entrance=a|b|c`). He picks an entrance variant → remove switch.
3. Still open with Dat: approve motion values (now incl. nav move + entrance); keep/drop uncommitted `src/app/dev/proto/cover-title/`.
4. On approval: log motion to `docs/design-system/motion.md`, then `worker_done` to coordinator (task `task_a05581562ca2`, dispatch `ctx_10599d77ad9d`) with commits, evidence, motion values. No PR/merge from this lead.

## Gotchas
- Caveats to tell Dat: no iPhone safe-area (16px fallback), Back has no reverse morph, Safari via WebKit only, WebKit hits `<body>` once per Tab cycle (harmless, main inert).
- Background dev servers die at the task time limit but the `next` child can survive in a broken state (500s on /work). Kill by PID (`netstat -ano | grep :3002`) and restart.
- :3002 server hit the 2h background limit and broke (500 on /work); killed. Dat runs it himself: pnpm exec next dev -p 3002 -H 0.0.0.0
