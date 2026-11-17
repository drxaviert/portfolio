# Site-optimize lead: handoff (2026-11-17)

## Goal
Fix the hover scrollbar, then do an optimization pass using the emil skills. Invisible fixes ship directly; visible ones wait for Dat.

## Shipped (all on main)
- **#36** Hover scrollbar: `overflow: clip` on `.ring-frame`. Root cause: the 614px nav glow's layout box counted toward scrollable overflow. 102/102 hover cases clean.
- **#37** Invisible batch: A3 ring rect cache (−19% forced layout per pointer move), A4 scoped `will-change` for the entrance blur, A6 forced-colors edges, A1 local `useReducedMotion`, A7 dropped `@mdx-js/react`.
- **#38** Drawer first-click latency: `generateStaticParams` on the intercepted route plus prefetch on the featured link. Fast-4G cold click→morph went 426→51ms.
- **#39** (approved motion) Featured-card ring grows by `transform: scale`, not `clip-path`. RasterTask 11.8→0.1ms, GPUTask 121→25ms per hover. Drawer content now leads the morph by 300ms. Logged in docs/design-system/motion.md.
- **#40** B2: nav Play/About are `<button>` (pixel diff 0 on hover/focus). B3: reader thumbs use `max(16px, env(safe-area-inset-left/right))`.
- **#41** A1 finished: motion/react is out of `/` first-load JS. The reader lends `animate` to the nav dock via nav-flight. `/` route chunks 68.3→39.4 kB gz, total initial 235.6→206.7 kB. Nav/panel progress matches within 0.001 per frame.

## Dropped / parked
- A2 (lazy horizon shader): dropped, because it delayed the WebGL fade by ~300ms.
- **A5 metadata / OG / icon / robots / sitemap: PARKED per Dat.** It lives on branch `polish/metadata-a11y` @ f820f81 (worktree polish-metadata). The branch includes a Playwright homepage-capture OG. It needs a domain (falls back to `NEXT_PUBLIC_SITE_URL`) and a rebase. B2 and B3 were cherry-picked out of it, so drop those two commits when it is rebased.

## Open
- B3 does nothing until `viewport-fit=cover` is set (env() insets are 0 today; Safari letterboxes landscape). Turning cover on is a visible, site-wide change. Ask Dat.
- About 245ms of main-thread reader render on the first drawer open at 4× CPU (untouched). The first open may also pay a few ms for evaluating motion's module (#41), which can't be resolved against host noise.
- Every audit A-item is shipped, dropped or parked.

## Housekeeping
- Released workers: motion-ab, home-no-motion, perf-invisible, polish-metadata.
- Worktrees motion-ab, home-no-motion and perf-invisible are merged and can be removed. Ask Dat before any rm. Keep polish-metadata while it is parked.
- Dev server is on :3006 from this worktree (PID 76528).

## Gotchas
- opencode `--model` fails with `--worktree new-child`; omit `--model`.
- worker-read truncates final replies, so have workers write their reports to a file.
- `pnpm format:check` flags about 170 files because of CRLF in Windows checkouts. This was already the case.
