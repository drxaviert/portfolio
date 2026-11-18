# Drawer on carousel timing + early WebGL glow A/B (handoff, 2026-11-18)

## Goal
Give the work drawer the home carousel's duration and easing, fix the reader ruler and the close shadow, then compare ways to start the horizon WebGL glow earlier.

## Shipped (origin/main ca0033f)
- PR #62 (5c2c1b6): drawer open runs 900ms `cubic-bezier(0.25,0.8,0.25,1)` from carousel-settings/easeSpec (`src/components/work/carousel-step.ts`), covering the card-to-panel FLIP, the content fade and defocus, and the nav flight. Close: 350ms on the row's retarget curve (quint-out). The `?motion=` switch and the old 480ms open are removed. Specs are in `docs/design-system/motion.md`.
- PR #63 (ca0033f):
  - Close shadow fix: the FLIP scaled the 70px drop shadow, which left a grey band and cut the radius. While closing, the elevation crosses to the card's flat shadow over 350ms.
  - Ruler entrance: the cascade's next beat, starting 560ms after the reveal, 900ms on the defocus curve, blur(8px) to none.
  - Ruler exit: a 160ms ease-out blur-fade from the first close frame. measure() is skipped while closing; it was blocking the frame.
  - Content exit: 300ms on the retarget curve, scaling with the panel. It was 140ms, which left the panel empty.
  - Reduced motion: opacity only, 120ms.
- Decisions Dat rejected: the slide motion itself (wanted timing only) and a 720ms close (kept 350ms).

## Glow early-start A/B: rejected, kept current
- Local branch `exp/glow-early-webgl` @ 0547683, worktree `C:\Users\Dat\orca\workspaces\portfolio\glow-early-webgl`, unpushed and unmerged. It has the inline, script and OffscreenCanvas worker variants. The measured table is in memory `glow-early-start-rejected`.

## Open
1. Dat to run the removals (the guard blocks rm):
   - drawer worktree `C:\Users\Dat\orca\workspaces\portfolio\drawer-slide-motion`
   - `.claude\worktrees\agent-aac75dba60c205050`
   - `%TEMP%\opencode\drawer-open` and `%TEMP%\opencode\drawer-motion`
   - Then `git worktree prune`.
2. Decide whether to delete `exp/glow-early-webgl` and its worktree (worker ctx_dc6a3f67f2ff is stopping :3101, then release it).
3. Done: PR #64 merged (119a9f7). Next project keeps the drawer still and plays the 900ms content cascade, with the ruler beat at 560ms. Back is depth-aware, and close lands on `/`. Specs are in motion.md. Its worktree `C:\Users\Dat\orca\workspaces\portfolio\drawer-next-project` is waiting for Dat to remove it. Still open: after several swaps, focus returns to the card first opened.
4. Pre-existing dev-only Next warning `instant-shell-url-data` on `/(.)work/[slug]`.

## Gotchas
- Write worker specs to a file and pass `--spec "$(cat file)"`. Backticks inside an inline spec run as commands; one started a stray dev server on :3000.
- An OpenCode worker in `--worktree new-child` can't take `--model`.
