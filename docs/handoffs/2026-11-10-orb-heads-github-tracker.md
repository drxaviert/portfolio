# Handoff: orb head colors + GitHub tracker (Figma), 2026-11-10

Follows `2026-11-09-figma-horizon-glow.md`. File `18bX1w3gLtGeKJ2KS2K2BT`, page Design. Plugin channel was `aiwebk4b`; it changes on reconnect, so ask.
DeepSeek worker: Orca run `run_90f0a459a8ff`. The last dispatch is `ctx_650157d6ba28`. Continue it with `orca orchestration send --to dispatch:<id>`.

## Orb head: decided and applied in all 24 phase frames
- Night (115:1190, 117:433/487/541/595/649): linear gradient, handles (0,1)->(1,0), stops 0 #D6B49D (mint #AFFFEA mixed 50% into orange), 0.45 #FD6850, 1 #FD6850. The user wants orange as the main color. The plain orange #FD6850 comes from Final · Dark 102:1214; it is variable-bound there but a literal paint in the phase frames.
- Dawn: #FF90B9 -> #CB83FF. Day: #60A8E2 -> #0071C1. Each is that frame's own blob-left -> blob-right color, bottom-left -> top-right.
- Dusk: "pink bridge" #B4D8FF @0, #F7C1D9 @0.5, #FFB451 @1. The original blue->amber passed through grey, which the user called muddy.
- The specular highlight stays hidden everywhere (matte).
- Test frames (page-level, y 12250, safe to delete when the user OKs it): 117:1424 Night violet, 117:1483 Night mint, 117:1538 Dusk warm, 117:1593 Dusk pink bridge.

## GitHub tracker in the top-left square card (275x276, content 263x264)
- Goal: show **shipping consistency**.
- First mockups (y 13574): 117:1648 grid, 117:1703 bars, 117:1758 ring.
- The user picked the **grid**: familiar to portfolio visitors. They want it to **fill the square** with **less attention on the text**.
- In progress at handoff: worker task `ctx_650157d6ba28` builds 2 clones of 117:1648 in a row 300px below:
  - Both: two stacked 7x13 bands (26 weeks), inset 12, softer levels #EEF2F7 / #D9E8F5 / #B5D3EE / #7FB2E0 / #3D8FD3, organic seeded data.
  - "silent" has no text.
  - "caption" has one line "Shipped every week · 26 wks" at 11px, 40% opacity.
  - Exports: scratchpad `grid-v2-silent.png` and `grid-v2-caption.png` in `C:\Users\Dat\AppData\Local\Temp\claude\d69626ef595bb6b7\79188563-d9f6-4754-8856-cb7c197344a8\scratchpad\`.
- Rejected: bars (worked, but not the familiar pattern); ring (ticks not truly radial, streak unclear).
- The grid in v1 was row-striped (weekend rows pale) and too saturated. v2 addresses both.

## Next
1. Review the grid v2 exports with the user; pick silent or caption (or a hover-reveal caption in code).
2. Roll the chosen grid out to every phase and breakpoint, tinted per phase (derive 5 levels from each phase's blob colors; Night on a dark card needs dark-base levels). Rework it for 375 (the card becomes a horizontal bar).
3. Then the earlier queue: card hairline, theme-switch prototype, code implementation.
