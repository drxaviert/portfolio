# Handoff: orchestrator view, part 2 (2026-11-15)

## Goal
This chat dispatches, merges, cleans up and reports (memory `one-lead-chat-per-job`). Run `run_90f0a459a8ff`. It supersedes 2026-11-15-orchestrator.md.

## Done this session
- **Docs on main:** `7d07a4d` (docs/workflows + the 11-14/11-15 handoffs), pushed.
- **auto-phase-picker cleanup:** finished. The worktree, the local branch and the folder are all gone.
- **Drawer merged:** PR #29 is merged and main is at `4a355a7`.
  - The new lead `ctx_b546f251c2ea` merged main in (`295bc1a`, 288 tests pass) and was released.
  - The old lead `ctx_10599d77ad9d` was abandoned. `ctx_e3f3a8254326` and `ctx_2e70dbd129a0` were released.
  - The :3002 server was killed, and the remote branch `drxaviert/work-drawer` is deleted.
- **Drawer files saved:** the untracked drawer files were copied into the main checkout, still untracked:
  - `src/app/dev/proto/cover-title/`
  - `docs/handoffs/2026-11-1{4,5}-work-drawer-*.md` (4 files)
  - Dat hasn't decided whether to commit them.

## Open
1. **Drawer worktree removal (guard-blocked).** Run:
   - `git worktree remove --force C:/Users/Dat/orca/workspaces/portfolio/work-drawer`
   - `git branch -d drxaviert/work-drawer`
   - Its files are already copied out.
2. **Guard exception.** Dat said yes to it. Edit `C:/Users/Dat/.claude/hooks/destructive-guard.cjs`; both settings.json files point at that one script, at line 179. Read it first, since it's a protected dir, and confirm the diff with Dat.
   - Allow `git worktree remove [--force] <p>` and `rm -rf <p>` / `Remove-Item -Recurse -Force <p>` only when `<p>` is a direct child of `C:/Users/Dat/orca/workspaces/portfolio/`.
   - It must also be either an unregistered worktree, or a worktree whose branch is merged into origin/main (`git merge-base --is-ancestor`).
   - Pipe-test it, then prove it on the work-drawer removal.
3. **Carousel:** `ctx_e298a4a6ef8e`, :3005, branch home-carousel, a kept-open lead talking to Dat.
   - It's fixing the grey band that fills the gap mid-step.
   - After that, rebase or merge it onto main (`4a355a7`), which now contains the drawer, and drop the duplicate commit `a9e92e2` (duplicates `bbd36ee`).
4. **Drawer follow-ups, parked:**
   - `/work` has no index, so it 404s.
   - Hard-load a study, open another, then close: the reader stays with the dock in its home state.
   - Real-iPhone blur check.
   - Whether to delete /dev/proto/work-drawer.
5. **Design system:** the public generated system page.

## Gotchas
- `orca orchestration send` to an *exited* worker does not revive it. Start a new worker with `worker-start --worktree path:<p> --agent claude --keep-open`.
- Abandoning a worker bounces its unread mail back here as "messages". Ignore them.
- `worker-list --json` is huge. Grep it for a single dispatchId.
- Dat's PowerShell: commands pasted onto a half-typed line get concatenated. Give one command per block.
- `node_modules` folders take a while to delete, so recheck before reporting a failure.
