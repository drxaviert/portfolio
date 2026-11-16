# Handoff: work drawer BUILD, lead session 3 (2026-11-13)

**Role:** the Opus lead kept open for the Work drawer build. Execute the 8-task plan `docs/superpowers/plans/2026-11-13-work-drawer.md` (spec `docs/superpowers/specs/2026-11-13-work-drawer-design.md`) with superpowers:subagent-driven-development.

## Process

The skill's scripts are in `~/.claude/plugins/cache/superpowers-marketplace/superpowers/7.0.2/skills/subagent-driven-development/scripts/`.

- **Brief:** `task-brief PLAN N`.
- **Dispatch:** copy `task-6-dispatch.md` and update its context bullets.
- **Implementer:** `orca orchestration worker-start --spec "$(cat <dispatch>.md)" --worktree current --agent opencode --model opencode-go/deepseek-v4.1-flash --json`.
- **Review package:** `review-package PLAN BASE HEAD`.
- **Review:** a DeepSeek worker (Sonnet only if its review is thin) told to follow `task-reviewer-prompt.md` with the brief, report and diff paths. Re-reviews follow `re-review-prompt.md`.
- **Fix rounds:** `orca orchestration send --to dispatch:<id> --body "$(cat task-N-fixK.md)"`.
- The ledger is `.superpowers/sdd/2026-11-13-work-drawer/` (git-ignored). Its `progress.md` is the source of truth, including all rulings and deferred minors.

## Status (HEAD 96b7e55)

- Tasks 1–6 are complete and reviewed clean.
  - T5 (`e9b4795..5445ad3`): progressive blur.
  - T6 (`5445ad3..9b74759`): the ways back.
- **origin/main merge: done and reviewed clean.**
  - Merge commit `9769810` brings in #19 faux-ui, #20 nav-glide and #21 nav-ds-break.
  - Test fix `96b7e55`.
  - Glide and #21 are intact. The reader close capture and the reader.css popover selectors still match.
- **New on main since the merge:** `82766ed` (#22 phase-from-night). It touches `theme-toggle.tsx` and `theme.test.tsx` next to Task 4's Esc preventDefault changes, so expect conflicts. The lead decides whether to merge it before Task 7 or Task 8. It must be merged before showing Dat, because the nav must match the live homepage.
- Tasks 7–8: not started.

## Rulings this session (all in the ledger)

- **Reader nav background:** reverted the worker's removal of the reader nav's own fill. The nav must be pixel-identical to the homepage nav. The spec's "Replaces the opaque NavHeaderBar" refers to a separate prototype bar.
- **Nav height:** comes from a single variable, `--wd-nav-height` (reader.css:17). Never hardcode 64px.
- **iPhone safe area:** no site-wide `viewport-fit=cover`, so the mobile buttons fall back to a 16px bottom offset. **Tell Dat when showing the build.**
- **Main merge:** merged all of main, not just #19. Glide is the source of truth, with Task 4's Link and close behavior re-applied on top.
- **Carried over:** Back closes without the reverse morph (tell Dat). Overlay "Next project" uses replace. Esc on a direct-load page does nothing.

## Gotchas

- The dev server on :3002 is shared. Never run `pnpm build` while it's up.
- Do not merge to main and do not open PRs.
- Safari has not been verified anywhere. That is Task 8's job, together with the reduced-transparency check and the parity and resize matrices.

## Next

1. Merge #22 (`82766ed`), with the same rules as the last merge: main is the source of truth, and Task 4's Esc preventDefault is re-applied on top. Use the merge worker (`dispatch:ctx_fe3b7f29e694`), then a scoped review.
2. Task 7, base `96b7e55`. Then Task 8. Then the final whole-branch review per `references/final-review.md`, which covers the deferred minors in `progress.md`.
3. Show Dat the build after review. On approval, send `worker_done` to the coordinator (task `task_a05581562ca2`, dispatch `ctx_10599d77ad9d`) with:
   - the commits;
   - the evidence;
   - the motion values from the plan's Global Constraints, for `motion.md`.
