# Figma bind report — Night menu fill + literal colours → variables (2026-11-10)

File `18bX1w3gLtGeKJ2KS2K2BT`, Design page 102:1321 only. Bridge ws://localhost:3055, channel `1bhk4343`.

## Part 1 — Night menu fill
- Node `129:9705` "menu surface" (RECTANGLE 168×132 inside `129:9704` "theme menu", in `129:9604` "Night · 375 · theme menu open").
- Old `#191919` (r 0.098) → new `#262626` (r 0.149), bound to `surface-container` = `VariableID:102:1707` (Color · Dark), not a literal.
- Screenshot confirms the sheet now reads lighter than the #191919 cards behind it.

## Part 2 — literal paints bound per phase
| Phase | Section | Collection | Solid paints | Already bound | Newly bound | Unmatched | Ambiguous | Hidden paints skipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dawn | 121:3828 | Color · Dawn | 1346 | 78 | 1099 | 34 (+99 zero-alpha) | 0 | 36 |
| Day | 121:1349 | Color · Light | 1347 | 78 | 1099 | 35 (+99 zero-alpha) | 0 | 36 |
| Dusk | 121:5067 | Color · Dusk | 1346 | 78 | 1099 | 34 (+99 zero-alpha) | 0 | 36 |
| Night | 121:2589 | Color · Dark | 1346 | 12 | 1179 | 20 (+99 zero-alpha) | 0 | 36 |

4,475 bindings issued, 4,475 succeeded, 0 errors. Role rules used: text→on-surface/on-surface-variant, strokes/icons→on-surface*, grid/pager→tracker/0–4, toggle→toggle/*, containers→surface*/surface-container*, dividers→outline-variant.

### Top unmatched hex values (no variable in the phase collection)
- Dawn: #E5EDF5 ×8, #000000 ×7, #FF90B9@6% ×6, #CB83FF@6% ×6, #FFFFFF@55% ×6, #FFFFFF@10% ×1
- Day: #000000 ×8, #E5EDF5 ×8, #60A8E2@6% ×6, #0071C1@6% ×6, #FFFFFF@55% ×6, #FFFFFF@10% ×1
- Dusk: #E5EDF5 ×8, #000000 ×7, #B4D8FF@6% ×6, #FFB451@6% ×6, #FFFFFF@55% ×6, #FFFFFF@10% ×1
- Night: #6763E4@6% ×6, #AFFFEA@3% ×6, #FFFFFF@55% ×6, #000000 ×1 (section root), #FFFFFF@10% ×1

What they are: `#E5EDF5` = `frame-line/*` guides on the 1440/1920 frames; `#000000` = breakpoint caption texts + the section frame fill; `@6%/@3%` = the two gradient blobs per frame (phase accent tints); `@55%` = avatar highlight inside the `Head` instance; `@10%` = section frame stroke. Zero-alpha (`#FFFFFF@0%` ×49, `#000000@0%` ×42, `#E5E5E5@0%` ×8) are invisible placeholder fills, also unmatched.

## Safety checks
- Nodes: Dawn/Day/Dusk 1365/1366/1365 before and after, Night 1365 → 1365; 0 deleted, 0 added.
- Colours: diffed every solid paint before/after — 0 colour changes in Dawn/Day/Dusk; Night had exactly 1, the intended `129:9705` #191919 → #262626.
- Spot-check (paint hex before → after, bound variable resolved value): Dawn `121:3833` "work" #D9D9D9 → #D9D9D9 (surface-container-highest); Day `121:1356` "work" #E5E5E5 → #E5E5E5 (surface); Night `121:2667` "Work" #F2F2F2 → #F2F2F2 (on-surface).
- Section frames themselves (2 paints each: fill + stroke) were left alone — the task scope is descendants.
