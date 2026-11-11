# Handoff: dim tracker palette + 3-segment theme toggle → code (2026-11-10)

Follows `2026-11-10-tracker-widget-rollout.md`. Figma file `18bX1w3gLtGeKJ2KS2K2BT`, page Design. The plugin channel changes on every reconnect (it was `1bhk4343`), so ask for it.
DeepSeek worker: Orca run `run_90f0a459a8ff`, last dispatch `ctx_f34061e05ecd` (finished). To give it more work: `orca orchestration send --to dispatch:<id>`.

## Done this session
- The tracker is in all 24 phase frames. **Cards have no stroke** (the user's call on 2026-11-10; the 1px hairlines were removed). Rule: cards and modals/menus never get a stroke. They get the `shadow-light` effect style on light phases and `shadow-dark` on Night. In code that means solid fills, no border, and a shadow token for each theme.
- Deleted the 11 old mockup and orb test frames. 117:3378 is still the reference card.
- **Dim palette approved**, built as a separate set. The originals moved to the Exploration page 127:9124, renamed `<Phase> · breakpoints · original`. The Design page 102:1321 now holds, at x 0 and all 6407×1400: Dawn 121:3828 (y 0), Day 121:1349 (y 1800), Dusk 121:5067 (y 3600), Night 121:2589 (y 5400) — all named `<Phase> · breakpoints` without the `· dim` suffix — plus Theme toggle 122:7858 at y 7200. Exploration 127:9124 also holds the Final / Glass rim frames, the tracker iterations, toggle test 125:8697, the moved frame 124:8553 and reference card 117:3378. (The dim homepage comparison frame 121:6306 was deleted on 2026-11-10 because it was redundant.)
- Dim ramps, L0 to L4 (active dot is L4, inactive dots L2):
  - Day F3F8FC E4EFF9 CDE2F4 AED0ED 81B6E2
  - Dawn FBF6FE F5EAFE EDD8FC E1C0FB D19EF9
  - Dusk FEF8F2 FCEEE1 F9E0C8 F5CCA6 F0B075
  - Night 241D1C 342220 4B2A25 6B352D 9D4739 (on the #191919 card)
- Toggle mockup frame 122:7858 "Theme toggle · 3-segment": Day (sun) · Auto (clock) · Night (moon). It is 256 wide and 32 tall, with three 84px segments, radius 8, 16px icons at 1.4 stroke, Work Sans Medium 16. Light: track #E5E5E5, selected segment white. Night: track #0D0D0D, selected segment #333333.

## Behaviour rules (also in memory as theme-toggle-auto)
- Auto follows the local clock: Dawn 5–8, Day 8–17, Dusk 17–20, Night 20–5.
- Day stays light but follows the clock: Dawn 5–8, Day 8–17, Dusk 17–5.
- Night is always Night.
- First visit defaults to Auto. The choice persists in localStorage. There must be no flash on load (extend the existing flash-free theme script from commit d658d7f).

## Next (code, fresh session)
1. Theme provider: phase = f(mode, local hour). Expose `data-phase` (dawn, day, dusk, night) and `data-mode`. Re-check the hour on an interval or on visibility change.
2. Theme toggle component, order **Day · Night · Auto** everywhere (changed 2026-11-10). At 768 and up: **icon-only, 104×32** (the user picked it over labelled 256×32 after comparing them in frame 125:8697), with hover tooltips "Day" / "Night" / "Auto · follows your clock" and an aria-label on each segment. At 375: a 32×32 button that shows the current mode's icon and opens a menu above it (the 375 nav is a bottom bar) with Day, Auto and Night plus a check on the selected one. Mockups: 122:7858 (Phone · theme button 124:8503 light, 124:8532 night), open-state frames (Auto selected, in each Design section next to the 375 phone): Dawn 129:9367, Day 124:8553, Dusk 129:9486, Night 129:9604 (dark card #191919, selected row #333333).
3. Tracker widget: two bands of 7 rows × 16 weeks, using the dim palette per phase. On hover, show the caption "Shipped every week · 32 wks". The 3-dot pager switches between widgets. At 375 the card shows one band of 7 weeks.
4. ~~Figma: toggle in the dim frames~~ done 2026-11-10, in all 20 dim navs.

Check that `package.json` exists before running pnpm.
