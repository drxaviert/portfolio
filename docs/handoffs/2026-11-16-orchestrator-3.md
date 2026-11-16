# Handoff: orchestrator view, part 3 (2026-11-16)

## Goal
This chat dispatches, merges, cleans up and reports (memory `one-lead-chat-per-job`). Run `run_90f0a459a8ff`. It supersedes 2026-11-15-orchestrator-2.md.

## Done
- **Drawer follow-ups shipped:**
  - PR #30 (`19dd367`): hard-load fix, `/work` 308 redirect to `/`, `/dev/proto/work-drawer` deleted.
  - PR #31 (`e512a5a`): Back-button fixes; every close flies into its origin card.
  - PR #32 (`22d0802`): reader scroll ruler. Main is at `22d0802`.
- **Tasks:** `task_a05581562ca2` was settled. The stale Spotlight (`ctx_892991b5def6`) and Merge PR #8 (`ctx_b19f9e3009fd`) workers were stopped with Dat's yes.
- **Vercel:** branch pushes make preview deploys only. Production changes only on a merge to main. Dat is fine with this.

## Open
1. **Guard exception (Dat said "do that").** Edit `C:/Users/Dat/.claude/hooks/destructive-guard.cjs`, which both settings.json files point at.
   - It's a protected dir: read the file first, show Dat the diff and get a yes before writing.
   - Allow `git worktree remove [--force] <p>` and `rm -rf` / `Remove-Item -Recurse -Force <p>` only when `<p>` is a direct child of `C:/Users/Dat/orca/workspaces/portfolio/`.
   - It must also be either unregistered, or a worktree whose branch is merged into origin/main (`git merge-base --is-ancestor`).
   - Pipe-test it, then prove it on the work-drawer removal.
   - Delegate the drafting and testing to a worker.
2. **Old work-drawer worktree.** Dat may run these himself, or the guard exception from item 1 will cover them:
   - `git -C C:/Users/Dat/orca/portfolio worktree remove --force C:/Users/Dat/orca/workspaces/portfolio/work-drawer`
   - `git -C C:/Users/Dat/orca/portfolio branch -d drxaviert/work-drawer`
3. **drawer-followups cleanup.** Dat said yes. The :3006 and :3016 servers are stopped and the lead is released.
   - Only the worktree is left (it holds just `dev-3006.log`). The guard blocked removing it, so Dat runs it:
     `git -C C:/Users/Dat/orca/portfolio worktree remove --force C:/Users/Dat/orca/workspaces/portfolio/drawer-followups`
4. **Untracked files in the main checkout.**
   - cover-title proto: Dat called it placeholders. It was moved out of the repo to `C:/Users/Dat/orca/quarantine/portfolio/2026-11-16-cover-title/` and the :3020 server is stopped.
   - Drawer handoffs in `docs/handoffs/` (`2026-11-14-work-drawer-{build,t8,t9}.md`, `2026-11-15-work-drawer-t14.md`) plus the orchestrator handoffs are still uncommitted. I recommended committing them as a record; waiting on Dat.
5. **Carousel.** The lead is `ctx_e298a4a6ef8e` on :3005. It is fixing a card border that "pops" right before the card settles (`ctx_fe8209b47a4c`).
   - Then rebase it onto main `22d0802` and drop the duplicate commit `a9e92e2`.
6. **Parked.** Real-iPhone blur check (Dat has no iPhone). The public design-system page.

## Gotchas
- `task-update` refuses a task whose dispatch is still active. Run `worker-stop --dispatch <id>` first; that settles it.
- `task-list --json` and `worker-read` output are huge or truncated. Grep or tail them.
- Give Dat one command per block in PowerShell.
