# Handoff: Day phase picker - PR #12 push + merge in flight (updated 2026-11-12, late)

## Goal
Ship the Day phase picker (Clock/Dawn/Midday/Dusk row above the theme toggle) and its motion, then log the motion to the design system.

## State
- Worktree C:\Users\Dat\orca\workspaces\portfolio\day-phase, branch feat/day-phase-picker, :3001. PR #12 open:
  https://github.com/drxaviert/portfolio/pull/12
- MERGED: PR #12 merged as 5bbfba9 (includes 1126a07); CI green after merge; main pulled locally.
- Unpushed commits at send time: f275bf5 (hover = entrance settle, WAAPI), 430d446 (Dusk clip on the correct side,
  rays split out), 309edba (row hover region = Day + bridge + row, so it closes 100ms after leaving Day),
  1126a07 (Dawn/Dusk frame lines matched to Midday visibility). 125 tests pass.

## Final shipped decisions (user picked in dev with sliders)
- Hover: follow pill (Classic) + press scale .94. Icon hover = the entrance settle, played once, ending at rest.
- Row entrance = option 6 "Stagger + icons", left to right: enter 400ms / exit 240ms, segment delays 120/170/220/270ms,
  icon settle 600ms cubic-bezier(.34,1.3,.64,1) from poses rays -76.5deg, clock hands -102deg, dawn/dusk 6.8px,
  scale .745 (Night moon rotate -40deg). Close delay 100ms. Reduced motion = 120ms opacity fade, no icon motion.
- Dawn clips the sun above the horizon, Dusk below it (permanent clipPaths, useId).
- Dawn/Dusk frame lines: the rest colour now equals Midday's #d4dce4 (loses the phase hue). Hover spotlights use each
  phase's accent hue (Dawn #a671cf, Dusk #c97601). The user accepted this.

## Next
1. (done) Merge confirmed.
2. Log the motion spec to the design system (memory: log-motion-to-design-system): a motion section in docs/design-system/
   plus the Figma "Design System" page (Figma goes to a DeepSeek worker). Take the values from the merged code.
3. Ask the user before removing the day-phase worktree and branch (user runs the force-remove; the hook blocks it).

## Gotchas
- The worker's dev-control tasks were all deleted before the PR, so there's no leftover localStorage keys/dev UI.
- A pending user cleanup from before: the frame-hover worktree and proto/frame-hover branch (see git worktree list).
