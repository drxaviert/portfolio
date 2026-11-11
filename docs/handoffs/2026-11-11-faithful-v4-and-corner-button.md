# Handoff: play card Faithful v3/v4 and work-card corner button (2026-11-11)

Follows `2026-11-10-play-card-variations.md`. Orca run `run_90f0a459a8ff`. Figma channel was `1bhk4343` (ask for the new one on reconnect). Both workers are DeepSeek (opencode-go/deepseek-v4.1-flash).

## Play card (section 133:13342, Exploration page)
- v2 rows exist for all 4 directions (soft feathered glow; Depth = 3 parallax layers; Silk wave = ribbon with one fold, which still reads as a thick band with dark edge outlines, not fine silk).
- User PICKED **Faithful**. v3 row 148:16354: Dawn 148:16223, Day 148:16181, Dusk 148:16276, Night 148:16315. The card is f2f2f2 (Night 262626) with a 16px inset art panel (817x244, r8, clipped), and the fan reaches ~68% height on a dome with jittered lengths. Dots stay clear of the sides. Export: C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v3-row.png.
- **DONE, not yet reviewed by Opus:** v4 Day card 148:16367 (strands layer 148:16390), export C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v4-day.png. Highest point is 67.9%, and 192/560 tips point below horizontal. Original brief: **Faithful · v4 · Day only** (new row below v3): a gentle gravity bend, cubic-bezier cantilever sag ∝ reach², ±15% jitter, 2.5–3.5px tip dots, still ≤68% height, NOT the old Fibre lamp fountain. Export → C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v4-day.png. The user approves Day first, then the other phases get built.
- User feedback on v4: many strands are missing their tip dot, and the gradient should be more interesting (like the Stripe fan: warm peach core radial glow, then a pale blue halo, then white; strands warm at the base and blue/indigo at the tip; varied opacity; a dot on every tip). CORRECTION: the new gradient is for the BACKGROUND only; the strands keep v4 colouring. **DONE, not yet reviewed by Opus:** v5 Day tile 148:16429 (background 149:16485 is a warm EFBE8C core at 52% over an A9CAEA-to-white radial; strands 149:16475 use the v4 style; 560/560 dots). Open call: the dots sit outside the fade mask, so the top tips may look detached; moving them back inside the mask is a one-line change. Day still needs user approval before Dawn, Dusk and Night are built. Export → C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v5-day.png.
- User decisions: bend = **gentle**. In code, **plan for sway**: strands bounce or sway near the cursor, with the v4 bend as the rest pose.
- Generators: docs/handoffs/figma-scripts/gen-v2/v3.cjs, build-v2/v3.cjs.

## Work card corner button (section 147:16070 at 8000,1600)
- Source card 'highlight-work': Day 102:1766, Night 102:1223 (753x416, r12, 32px pad, title at bottom left).
- A tinted chip / B raised circle / C bare icon / D "View ↗" pill, at the 32px top-right inset. IDs are in docs/handoffs/work-card/manifest.json; export: corner-button-variations.png.
- Opus review: B is the clearest. All four are undersized for this card (scale to ~36–40px). A almost disappears on Night (raise the fill to ~16%).
- **DONE, not yet reviewed by Opus:** **E · Corner arrowhead** row 148:16355 (Day cell 148:16361, Night cell 148:16366): a thin L stroke with a rounded bend (r 7.25), 24px arms, 16px inset, 1.5px, accent at 40%. Export: C:/Users/Dat/orca/portfolio-handoff-images/work-card/corner-button-E.png.
- **USER CHOSE C · Bare icon, scaled up.** DONE, not yet reviewed by Opus: plate 149:16488, rest Day 149:16495, hover Day 149:16500, rest Night 149:16506, hover Night 149:16511. Next: build it in code on the work card. Row 'C · Final' (24px ↗, 2px stroke, 32px inset, on-surface-variant at rest; hover = accent + 2px nudge up and right). Export → C:/Users/Dat/orca/portfolio-handoff-images/work-card/corner-button-C-final.png.
- (Earlier) The user liked E. **DONE, not yet reviewed by Opus:** E2 plate 148:16402. Accent: Day 148:16408, Night 148:16413. Grayscale: Day 148:16419, Night 148:16424. Bend r6 (a true concentric offset would be 4px). Brief: E2 rows (accent at 40% + grayscale on-surface at 25%): 2.5px, 8px inset, bend concentric with the r12 corner. Export → C:/Users/Dat/orca/portfolio-handoff-images/work-card/corner-button-E2.png.

## Gotchas
- Fills are literal hex values (the fork drops variable bindings). Use figma-console `setBoundVariableForPaint` to bind them.
- `corner/sm` and the label/medium tokens are missing from docs/design-system/tokens.md. The worker used r8 and M3 label-medium (12/16).

## Next
1. Review the v4 Day and E exports (Read the PNGs) and show them to the user.
2. After v4 is approved: build Dawn, Dusk and Night v4, sending the task to the play-card worker via `orca orchestration send`.
3. The user picks a corner-button variant, which then gets scaled up.
4. Build Faithful (v4) in code: update the `--play-*` tokens, remove the unpicked variants in src/components/play/variants/, and add cursor sway.
5. Bind the Figma fills to variables. Commit only when the user asks.
