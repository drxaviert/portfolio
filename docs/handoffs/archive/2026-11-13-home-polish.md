# Handoff: Homepage polish (2026-11-13)

## Goal
Apply the safe fixes from the Emil-style homepage review, then decide the three open items.

## Done this session
- Motion audit (.scratch/motion-audit.md) → A/B toggle on feat/motion-pass (worktree workspaces/portfolio/motion-pass).
  User kept CURRENT motion. Only invisible fixes merged: PR #15 → main bb8558f (M3 transform/clip-path out of
  phase-switch rule, M6 pill will-change scoped, M8 exit colour 150ms, M9 comment). Memory: motion-pass-rejected.
- Homepage review: .scratch/home-review.md (14 rows, Before/After/Why table).

## In flight
- DeepSeek worker dispatch ctx_1c5225a8d3ea (run run_90f0a459a8ff) in worktree
  C:/Users/Dat/orca/workspaces/portfolio/home-polish, branch fix/home-polish, implementing review rows
  #1, #2, #4, #7–#14. Commits locally only, no push/PR. Spec: touch targets, spotlight mask perf, small polish.
- If its result is lost: `orca orchestration inbox --terminal run:run_90f0a459a8ff --limit 50`.

## Worker result (done)
- 3 local commits on fix/home-polish: 7ee317e touch targets, 0c8a301 spotlight perf, 8ebe92d polish (7 files).
  lint/test(125)/build pass. Rows #1,#2,#4,#7–#13 landed. #14 skipped: span:not(.tracker-cell) is NOT dead —
  it keeps 224 tracker cells out of the colour transition (globals.css:131-137); review row was wrong.
- #4 was rebuilt as a "pool" spotlight (transform-driven, junction snap) — user must eyeball it vs main.

- Reviewed by Opus; PR #16 open (https://github.com/drxaviert/portfolio/pull/16), tip 7702542, checks green,
  NOT merged. Dev servers: 3012 (PID 26696, launcher 20812) and 3000 (PID 30376, launchers 18956/19640).
  Worker left %TEMP%\opencode\portfolio-build-check (delete only with approval).

## Next
- Decisions: #3 CLOSED (removing opacity would make hover fades snap during the 400ms switch, not restore their
  own timing; see .scratch/phase-opacity-check.md). #5 CLOSED (user: cards are hover-only for now, click later).
  #6 IN FLIGHT: worker in worktree workspaces/portfolio/day-row-keyboard (branch feat/day-row-keyboard, dev :3014)
  fixing user-reported Tab bug (not all phase options reachable) + dev switch A current / B instant / C on-demand
  (key K). User chose A "Current"; variants reverted. feat/day-row-keyboard = tabbing fix 295a1f0 + overlap fix
  a6fe7c5 (outgoing highlight now releases instantly; pre-existing bug) — local only; worker also edited motion.md
  (keep only if user approves). NOW: worker prototyping METABALL highlight on new branch feat/metaball-toggle
  (same worktree, :3014): dev panel Current|Metaball (K), Goo slider 0–100, "Hover goos too" toggle, both rows.
  DONE: bc23d66 on feat/metaball-toggle, dev :3014 PID 45848, checks green, Safari unverified (Windows host).
  Neck slider added (2c87b61, :3014 PID 56308). User: trailing blob clips on track edge, and "I've seen better
  versions" — blur+threshold goo is not good enough. NEXT: get user's reference examples, then rebuild as a
  geometric SVG-path metaball (two pills + computed bezier bridge, redrawn per frame, no filter, no clip,
  Safari-safe), keep Goo/Neck/hover controls, compare vs current metaball.
  IN FLIGHT (dispatch follow-up of ctx_0752ea4530bc): 3 new variants on feat/metaball-toggle — Metaball (path),
  Liquid (iOS-style jelly capsule), Stretch & snap (lagging trailing edge) + existing Goo (blur), panel K cycles.
  DONE 60fc68b, :3014 PID 33108. Defaults: Metaball (path), Goo 35, Neck 70, Bounce 55, Lag 45, hover off.
  USER PICKED: Stretch & snap, Lag 100 (120ms), hover ON. Worker finalizing (remove panel + other variants,
  bake constants, log in motion.md), local commits only. Next: Opus reviews diff vs main, user OKs push/PR,
  then log to Figma motion frame (ask plugin channel).
  SHIPPED: PR #17 merged → main 4962069 (Stretch & snap + tabbing fix + overlap fix + motion.md). No Figma
  logging anymore (user: repo is enough). ALL REVIEW ITEMS DONE. Remaining = cleanup only (see step 3 below),
  plus dev servers :3000, :3012, :3014 still running.
  Then: user compares; Opus reviews diff; if chosen, remove dev panel, bake chosen Goo value, then PR.
  Was: recommended option B = row appears instantly on keyboard focus, mouse keeps full entrance.
0. (done) PR #16 merged → main ceab084. Remote fix/home-polish branch kept. Next is step 2 below.
1. (done) Review the worker's diff (`git -C .../home-polish diff main`), esp. #4 spotlight look unchanged and #8 menu
   still above cards. Then ask the user to push + open PR.
2. User decisions still open:
   - #3 drop `opacity` from phase-switch transition lists (globals.css ~:121/:161) — first confirm nothing
     (e.g. Horizon crossfade) relies on opacity fading during a theme switch.
   - #5 ring-host on non-clickable cards (home-cards.tsx:44/:59, tracker-widget.tsx:77) — maybe moot while
     cards are placeholders.
   - #6 tabbing onto Day opens the row with ~1s animation (theme-toggle.tsx:984) — option: open instantly on focus.
3. Cleanup only with explicit approval: feat/motion-pass branch + motion-pass worktree, remote
   fix/motion-cleanups, .scratch/*, and archive docs/handoffs/2026-11-13-motion-review.md (uncommitted).

## Gotchas
- OpenCode worker with --model needs an existing worktree: `orca worktree create` first, then
  `worker-start --worktree path:<path>`.
- Don't re-propose ring 800ms / glow 1s timing or phone-menu open animation (user decision).
- Use `pnpm dev:log`; Figma is the resting-size source; hover only grows outward.
