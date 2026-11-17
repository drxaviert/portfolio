# Handoff: theme toggle "box" stuck after Day/Night switch (task_14a0cb1c2632)

- Goal: Dat saw a "box" stay visible after changing Day/Night and moving the mouse out.
- The box = the Day-phase picker row (Clock/Dawn/Midday/Dusk) above the toggle.
- Repro: switch ending on Day (Auto>Day, Night>Auto>Day), pointer leaves the nav during the view-transition crossfade.
- Root cause: leaveHoverRegion / onDesktopPointerLeave ignore leaves while data-phase-switching is set; the pointer is already outside when hit testing returns, so no event ever closes the row.
- Fix (commit 3ae72ed, branch fix/theme-toggle-hover-stuck, not pushed): recheckHoverAfterSwitch() in src/components/theme/theme-toggle.tsx. A MutationObserver waits for the marker to clear, then 2 rAFs, then :hover on Day/bridge/row; scheduleClose() if none is hovered.
- Regression test: theme.test.tsx "closes the Day row when the pointer left during a theme crossfade" (fails without the fix).
- Evidence: Playwright probe (scratchpad probe.cjs) showed STUCK on 2/6 sequences before, 0/6 after at 50/200ms leave gaps; staying on Day keeps the row open; keyboard-first runs pass.
- Checks: typecheck, lint, 488 tests and build pass. Prettier flags these files on main already (pre-existing).
- Gotcha: pnpm build fails with EBUSY while dev:log runs (it holds .next/dev-server.log); stop the dev server first.
- Next: wait for Dat's OK on http://localhost:3012 / http://192.168.2.33:3012, then push, PR, merge, stop the dev server, send worker_done.
