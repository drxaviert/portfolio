# Handoff: Play card variations in Figma, recoloured to the phase palette (2026-11-10)

Follows `2026-11-10-phases-code-and-play-card.md`. Orca run `run_90f0a459a8ff`. The Figma channel was `1bhk4343`; it changes on reconnect, so ask for the new one.

## Decisions
- The user disliked the first three.js fan's design and colours. They want **variations designed in Figma first**, not code.
- References: the user's 2×2 fibre-fan image (white strands, tip dots, two-tone gradient plus a base band) and the **stripe.com hero `single-wave__canvas`** (one sweeping ribbon of ultra-fine fibres that looks like brushed silk, with a glossy sheen).
- The user said "keep everything, but match the colours on the Design page". All 4 directions are kept and recoloured to the phase tokens.

## Figma state (Exploration page only; Design page untouched: Day 1366, the other phases 1365)
- Section **"Play card · variations"** 133:13342 at x 900, y 14000. Tiles are 849×276, radius 12, shadow-light; columns are Dawn, Day, Dusk, Night.
  - Faithful: 133:13361 / 13373 / 13385 / 13397
  - Fibre lamp: 133:13409 / 13422 / 13435 / 13448
  - Depth: 135:14215 / 14237 / 14259 / 14281
  - Silk wave: 136:14303 / 14323 / 14343 / 14363
- Colours: Dawn #DDBDF8→#C79BF0, band #A974D8. Day #A9CAEA→#6FA3DC, band #3687D9. Dusk #F6DCC0→#EFBE8C, band #DE9750. Night #1C1C1E→#131316 on a #262626 surface, band #B85343, warm strands #FFF2EA.
- Export: `docs/handoffs/play-cards/play-card-variations-0.5x.png`. Generator scripts are in `docs/handoffs/figma-scripts/` (gen.cjs, buildRow.cjs).

## Opus review of the recolour
- It reads as the phase palette now. The horizon band is heavy and saturated against the "extremely subtle" horizon-glow rule; consider softening or dropping it.
- Depth still looks too close to Faithful in a still.
- Silk wave is a flat band, not fine silk; the Stripe texture and fold are missing.
- Variable bindings did NOT persist: the fork writes `paint.boundVariables` directly. All fills are literal hexes. To bind them, use figma-console `figma.variables.setBoundVariableForPaint`.

## Code (uncommitted, branch feat/time-of-day-phases)
- `/dev/play-card` has a 5-variant picker: Current, Faithful, Fibre lamp, Depth, Silk wave. Files are in `src/components/play/variants/`, plus a rewritten `play-lab.tsx`. The `--play-*` tokens in `globals.css` still use the SATURATED reference hexes; they don't match the Figma recolour yet. Gates pass. The dev server is stopped.

## Next
1. The user reviews section 133:13342 in Figma and picks a direction, or asks for fixes (band subtlety, Depth, Silk wave).
2. Port the chosen direction and colours to code; update the `--play-*` tokens and remove the unpicked variants.
3. Bind the Figma fills to variables via figma-console.
4. Commit when the user asks.
