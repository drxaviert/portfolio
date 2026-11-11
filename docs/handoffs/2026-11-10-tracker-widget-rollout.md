# Handoff: GitHub tracker widget, rollout to all phases (2026-11-10)

Follows `2026-11-10-orb-heads-github-tracker.md`. Figma file `18bX1w3gLtGeKJ2KS2K2BT`, page Design. Plugin channel `aiwebk4b` (it changes on reconnect, so ask).
DeepSeek worker: Orca run `run_90f0a459a8ff`, terminal structworker_fc8e8cc2. Latest dispatch `ctx_0ca1edea1d37` (rollout, **in progress at handoff**). Continue with `orca orchestration send --to dispatch:<id>`.

## Decisions
- Silent grid with no text in Figma. The caption "Shipped every week · 32 wks" appears on **hover, in code**.
- The top-left square card is a **widget container**: a 3-dot pager at the bottom switches between widgets.
- The approved card is 117:3378 / card 117:3397 ("Day · tracker · grid v4 · balanced"):
  - two stacked bands, 7 rows x 16 weeks each (32 weeks), square cells 11.125, 3px gaps, 9px band gap, radius 2
  - margins 20 top/left/right; dots 6px with 6px gap, bottom edge 16 above the card bottom, about 21 below the grid
- Why 16 weeks per band: 13 per band made the block taller than wide, and the card looked unbalanced (the user said so twice).
- Rejected: dots stacked on the right (looked like a stray grid column, card off-centre); the caption version.
- Day palette: #EEF2F7 / #D9E8F5 / #B5D3EE / #7FB2E0 / #3D8FD3. Active dot is L4, inactive dots L2.

## In progress (ctx_0ca1edea1d37)
- Worker puts the tracker into the top-left card of all 24 phase frames: sections 117:152 Day, 117:432 Night, 117:812 Dawn, 117:1093 Dusk.
- Other phases: the accent alpha-blended over that frame's card background at 0.07/0.18/0.35/0.6/0.92. Accents: Dawn #B86AF5, Dusk #F29A3A, Night #FD6850 (on the dark card).
- 375 bar: one 7-row band filling the width. If the cells would be under 7px, the dots move to a vertical stack on the right.
- Full brief: the session scratchpad `rollout-brief.txt` (may be gone); its key rules are above.
- Review export: frame 'Tracker rollout · review' → `C:\Users\Dat\AppData\Local\Temp\claude\d69626ef595bb6b7\e71781ce-23b2-435c-bba5-77cc4bb5a90d\scratchpad\tracker-rollout-review.png`.

## Leftover frames (delete once the user OKs it)
- Mockups at y 13574–13720: 117:1648 grid, 117:1703 bars, 117:1758 ring, 117:2011 v2 silent, 117:2362 v2 caption, 117:2714 v3 dots right, 117:2951 v3 dots bottom.
- Orb test frames: 117:1424, 117:1483, 117:1538, 117:1593.
- Keep 117:3378 as the reference.

## Next
1. Read the worker's rollout report and the review PNG (one image). Check: Night contrast on the dark card, the Dawn and Dusk hues, the 375 bar layout.
2. Get the user's sign-off on the per-phase colors; tweak the accents if needed.
3. Earlier queue: card hairline, theme-switch prototype, then code (hover caption, pager behavior).

Gotcha: whole-frame exports are 2880x2048 and cost the image budget. Export only the card node or a review frame.
