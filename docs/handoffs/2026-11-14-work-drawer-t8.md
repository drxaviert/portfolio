# Handoff: work drawer BUILD, lead session 4 (2026-11-14)

**Role:** Opus lead for the Work drawer build. Process unchanged from `docs/handoffs/2026-11-14-work-drawer-build.md` (scripts, ledger `.superpowers/sdd/2026-11-13-work-drawer/progress.md` = source of truth), with one change below.

## Rulings this session (all in the ledger)
- **Reviews → DeepSeek worker** (Dat): reviewer/re-review prompts run on `opencode-go/deepseek-v4.1-flash`; Sonnet only if a part comes back thin.
- **T7 composition A** (Dat): Cover fills the 753x416 card, title overlays bottom-left; hero renders the same scene at 753:416.
- **Title collision → soft fade** (Dat): radial `--surface-dim` fade, intensity 96% / reach-x 74% / reach-y 54% / falloff 80%, card only, never hero.
- **Below xl the Cover fills the card** (lead, Dat delegated): cover-fit anchored top-right, card size unchanged; morph re-frames on narrow cards (accepted).
- Scenes moved to `src/components/faux-ui/` (no prod import from `src/app/dev/`).

## Status (HEAD 953d66e)
- #22 merged: `a2de444` (auto-merge, diff vs main = only T4 Esc preventDefault).
- T7 complete: `4e84955` Cover, `029d15a` fade, `953d66e` cover-fill. Review + re-review clean (minors deferred to final review, listed in ledger).
- `e5a7cd3`: `allowedDevOrigins: ['192.168.2.33']` in next.config.ts — without it the LAN URL never hydrates.
- **T8 complete** (`ctx_4663b8f5bc8d`, report `task-8-report.md`): gates green incl. build, nav parity 24/24, resize matrix 5/5, no failures. Six non-blocking findings F1–F6 (see ledger); lead should fix F1, F2, F3, F6 and pin F5 easings in one fix round before the final review; F4 is dev-only.

## Uncommitted (lead's)
- `src/app/dev/proto/cover-title/` (title-options comparison + fade tuner). Ask Dat keep (commit) or drop before the final review.
- This handoff + the previous one.

## Next
1. One fix round for F1, F2, F3, F5, F6 (send to a DeepSeek worker), then a scoped re-review.
2. Final whole-branch review per `references/final-review.md` (DeepSeek), covering all deferred minors in progress.md.
3. Show Dat (give localhost + 192.168.2.33 links). Tell Dat: no iPhone safe-area (16px fallback), Back has no reverse morph, Safari only checked via WebKit, motion draft from T8 awaits approval.
4. On approval: log motion to `docs/design-system/motion.md`, then `worker_done` to coordinator (task `task_a05581562ca2`, dispatch `ctx_10599d77ad9d`) with commits, evidence, motion values. No PR/merge from this lead.
