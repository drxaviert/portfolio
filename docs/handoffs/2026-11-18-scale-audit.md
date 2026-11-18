# Design-system scale audit (handoff, 2026-11-18)

## Goal
Write everything up in the codebase design system (docs/design-system/), and put every value, motion included, on a scale by snapping it to the nearest step.

## Done this session
- PR #65 merged (3134071): drawer close focuses the card of the study on screen after "next project" swaps (data-work-slug on every carousel card). Dat tested it and approved.
- Dat ran or is running the cleanup of the drawer-* worktrees, glow-early-webgl and exp/glow-early-webgl (the guard blocks rm for me).

## Decisions (memory: scale-audit-rules)
- When in doubt, the current site wins.
- Approved motion seeds the scales and never moves: 900/350/560/160ms, cubic-bezier(0.25,0.8,0.25,1), ring scale factors, glide spring.
- Snap code only. Figma may drift.
- WebGL/procedural internals are excluded, documented but not snapped.
- Dev code (dev/, proto/, tuners, faux-ui) IS in scope. Tests are excluded.
- Layout dimensions snap to a size scale: multiples of 4 below 64, multiples of 8 from 64 up.
- Auto-snap when the change is ≤2px or ≤20ms. Anything bigger, any curve change or any z-order risk is a FLAG for Dat.
- Approved scales are in the spec below. Duration: 0,50,100,120,150,180,240,300,350,400,480,560,600,800,900,1000,1200,1500. Spacing: 0,1,2,4,6,8,10,12,16,20,24,32,40,48,64. Radius: 2,4,6,8,12,16,pill. Line-height: 1,1.1,1.25,1.4,1.5,1.6. Tracking (em): -0.01,0,0.025,0.08. Breakpoints: 768,1024,1280. z-index layers: base, raised, overlay, nav, drawer.

## State / files (scratchpad = C:\Users\Dat\AppData\Local\Temp\claude\d69626ef595bb6b7\5def1953-a08e-4b4d-aa70-bac651e7b66d\scratchpad)
- Step 1 inventory DONE: audit\inventory.csv (3,551 rows, 61% untokened) and audit\summary.md.
- Step 2 mapping DONE (worker ctx_09bbc4410e51): audit\mapping.csv, flags.csv, review.html (not yet read or published) and mapping-summary.md.
  - Totals: 2,828 KEEP, 314 AUTO, 314 FLAG, 95 SKIP.
  - Flags: easing 121 (ease-out ×70, ease-in ×12, ease-in-out ×8, Tailwind curves, approved spring/sheet curves marked keep), raw hex 57, dev type below 12px 35.
  - Open owner questions:
    - The globals.css duration tokens 160/170/220/230/250/270/280/330/360 sit off the 18-step scale. Shrinking them would mean rewriting the phase-row and icon-settle rows in motion.md.
    - Negative z-index values.
    - 1px hairlines.
    - The worker recommends keeping the current values for all three.

## Next
1. Review mapping-summary.md, then publish review.html as an Artifact for Dat. Dat decides snap or keep for each FLAG group.
2. Apply in a new worktree (create it with `orca worktree create` from origin/main and `--base-branch main`; run git fetch first, since local main went stale last time). Add tokens to globals.css (@theme / :root) and TS motion constants, replace literals, add a lint/test guard against raw values, then run typecheck/lint/test plus a before/after visual check.
3. Docs: docs/design-system/ (tokens, spacing, type, colour, surfaces, motion, components), following the emil-design-system-docs skill. Then a PR, which auto-merges after Dat approves.

## Gotchas
- An OpenCode worker with --model needs an existing worktree: create it first, then run worker-start --worktree path:<path>.
- `pnpm dev:log -- -p N` breaks (the args land after the redirect). Use `pnpm exec next dev -p N -H 0.0.0.0 > .next/dev-server.log 2>&1` in the background.
- Give Dat a LAN URL as well: http://192.168.2.33:<port>.
