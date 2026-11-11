# Handoff: design system updated with the phases → fix the DS page, then write the code (2026-11-10)

Follows `2026-11-10-dim-tracker-toggle-to-code.md`, which is still valid for the code behaviour rules. Plan: `~/plans/alright-take-this-design-atomic-flask.md` (Part A done, Part B to do).
Figma file 18bX1w3gLtGeKJ2KS2K2BT. The plugin channel changes on every reconnect (it was `1bhk4343`), so ask for it. DeepSeek worker: Orca run `run_90f0a459a8ff`, last dispatch `ctx_264760746810`.

## Done this session
- **Board tidied.** The Design page 102:1321 holds only: Dawn 121:3828 (y 0), Day 121:1349 (1800), Dusk 121:5067 (3600), Night 121:2589 (5400), all 6942×1400 and named "<Phase> · breakpoints", plus Theme toggle 122:7858 (y 7200).
  - The new page Exploration 127:9124 holds the originals ("· original"), the Final and Glass rim frames, the tracker iterations, and toggle test 125:8697.
- **Phone menu, one per phase.** Each phase section has a "375 · menu open" frame right of its 375 frame: Dawn 129:9367, Day 124:8553, Dusk 129:9486, Night 129:9604.
- **Colour collections.** New: Color · Dawn 131:10670 and Color · Dusk 131:10692.
  - Color · Light acts as Day and Color · Dark as Night. **The user renames these by hand**, since the plugin can't rename collections.
  - tracker/0–4 and toggle/track and toggle/selected are in all four collections. The Dawn/Dusk frames were re-bound (156 paints).
  - About 1130 nodes per phase still use literal hex instead of variables (navs, cards, accents, tracker, toggle). Binding them is open.
- **Components page, section "Theme controls" 131:10728:**
  - Theme toggle 131:10813 (selected × look, 6 variants)
  - Theme button 131:10874 (look × open, 4)
  - Theme menu 131:10989 (look × selected, 6)
  - The Design frames still use their own copies, because swapping in instances needs deletes.
- **Token table** with shadow values and component ids: `docs/design-system/tokens.md`. Shadows: light = 3-layer black at .06/.06/.04; dark = a 1px white ring at .08.
- **Storybook:** no for now (the user agreed). Use a dev-only `/dev/system` route instead.

## Next
1. ~~Fix the Design System page~~ done. Boards at x 0 with 400px gaps: the original 102:1846 (y 0, h 4064), Phase colours 132:11442 (y 4464), Shadows 132:11443 (y 6758), Theme controls 132:11444 (y 7778). All use #0D0D0D, radius 24, width 1920, 96px padding. The Color roles headers now read "Night · Color · Dark" and "Day · Color · Light", plus a caption pointing to the Phase colours board and a description naming all four collections.
2. Optional: the Night menu is almost the same colour as the cards behind it. Lighten it to about #262626 if the user agrees (they haven't answered yet).
3. **Part B code** (plan §B): M3 token rename in `src/app/globals.css`; `[data-phase]` blocks from tokens.md; `phaseFor` in `src/lib/theme.ts`; extend the flash-free script `src/lib/theme-script.ts`; update the provider and the toggle in `src/components/theme/`; add `/dev/system`. Check that `package.json` exists before running pnpm.
