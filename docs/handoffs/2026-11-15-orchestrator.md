# Handoff: orchestrator view (2026-11-15)

## Goal
This chat dispatches, merges, cleans up and reports (memory `one-lead-chat-per-job`). Run `run_90f0a459a8ff`. It supersedes 2026-11-14-work-drawer-and-nav-hover.md.

## Done this session
- **Home entrance (PR #25):** the worktree folder and the local branch are removed. Dat skipped the Safari check for now.
- **Auto opens the Day phase row (PR #27):** merged. Memory `day-phase-picker` is updated.
- **Nav shrink fix (PR #28):** merged. A view transition drops `:hover`, so the ring exit is delayed while `data-phase-switching` is set (`src/components/home/ring-hover.css`). Main is at `6ed4853`. The remote branch is deleted and the workers are released.
- **Leftover:** Dat must run these, because the guard hook blocks them:
  - `git worktree remove C:/Users/Dat/orca/workspaces/portfolio/auto-phase-picker`
  - `git branch -d drxaviert/auto-phase-picker`
  - if the folder remains: `rm -rf` on that path

## In flight
- **Drawer:** a background Sonnet subagent is merging it. Dat approved the branch (head `ae781f7`). The subagent merges origin/main in, runs the gates, opens the PR and merges it, kills :3002 and pulls main. If its result was lost, check `gh pr list --state all --head drxaviert/work-drawer`.
  - The lead (session claude_b752f283…) reported done, but its worker_done for ctx_10599d77ad9d was rejected because the identity changed. task_a05581562ca2 needs settling as succeeded.
  - The lead's DeepSeek worker ctx_2ac0eb6320d8 is released.
  - Leave `src/app/dev/proto/cover-title/` and `docs/handoffs/*` untracked; Dat hasn't decided on them.
  - Open with Dat: a real-iPhone blur check, and whether to delete /dev/proto/work-drawer (proposed, not approved).
  - Motion is already logged in motion.md by the lead.
- **After the drawer merges:** run the cleanup recipe for the drawer: release ctx_10599d77ad9d, remove the work-drawer worktree (Dat runs the rm), and delete the local branch.
- **Carousel:** ctx_e298a4a6ef8e, :3005, branch home-carousel (based on the work-drawer branch). The worker is live on the left-edge peek, `?peekRight=static|hover|none`. Params: `?sliver=crop|grey|tint`, `?blur=edge|peek|motion|none`, `&tune=1`.
  - After the drawer merges, rebase or merge it onto main. It carries a duplicate entrances commit, `a9e92e2`, which duplicates `bbd36ee`.
  - Then relay Dat's test feedback.

## Drawer merge: BLOCKED on conflicts (merge aborted, branch still at ae781f7)
Merging origin/main into the work-drawer branch conflicts in 8 files.
- **Trivial ones and how to resolve them:**
  - `next.config.ts`: keep main's 2-IP list.
  - `motion.md`: keep both sides.
  - `globals.css`: keep both sides.
  - `theme-toggle.css`: take main's `calc(...+ var(--phase-enter-delay))`.
  - `theme-toggle.tsx`: main's `tooltipBelow={dayActive || rowOpen}` may be obsolete, because the branch moved the tooltip sides into nav-dock.css.
- **Real ones:**
  - `home-layout.tsx`: main's `<EntranceCell>` wraps HomeNav, but the branch moved the nav to the root layout behind `[data-nav-slot]`.
  - `home-cards.tsx`: the `WorkSlivers` entrance prop clashes with the branch's items/buttons rewrite.
  - `page.tsx`: `entrance="soft" shipped` from main needs combining with `featured` from the branch.
- **Recommended:** send this to the drawer lead (it knows the nav-slot design). Its brief: merge origin/main in, keep PR #25's Soft focus entrance working on the nav slot, rerun the gates, then hand back for the PR and merge.

## Next
1. Resolve the drawer conflicts (above), then merge and clean up.
2. Move the carousel onto main and get Dat's test verdict.
3. Dat commits `docs/workflows/` and the handoffs on main.
4. Design system audit (parked chat): PR #26 merged motion tokens and the primitive colour tier. The next step there is the public generated system page.

## Gotchas
- OpenCode `--model` requires an existing worktree. Run `orca worktree create --name X --repo id:b90bae7f-a3df-4763-b88e-d2867843748d --no-parent --base-branch origin/main` first, then `worker-start --worktree path:<path>`.
- The destructive guard blocks `git worktree remove` and `rm` outside the repo. Dat runs those.
- `PORT=N pnpm dev:log` (it ignores `--port`). Give Dat both localhost and http://192.168.2.33:N.
- Dat sometimes merges PRs themself from Orca. Check `gh pr list --state merged` before creating one.
