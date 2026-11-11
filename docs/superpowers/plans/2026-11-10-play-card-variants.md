# Play card fibre-fan variants — implementation plan

Task: add 5 switchable fibre-fan variants to `/dev/play-card` and restyle the
`--play-*` tokens to the pastel reference. No home-page changes, no commits.

## Files

- `src/app/globals.css` — new token values per phase, add `--play-base`.
- `src/components/play/play-card.tsx` — CSS fallback gradient uses the base band.
- `src/components/play/variants/stage.ts` — shared three stage (DPR<=2, IO +
  visibility pause, reduced-motion still frame, phase observer, pointer).
- `src/components/play/variants/settings.ts` — pure data: types, defaults,
  slider metadata (no three import, so the lab chunk stays light).
- `src/components/play/variants/faithful.tsx` — 620 straight strands + tips +
  origin bloom, pointer parting, tip shimmer.
- `src/components/play/variants/fibre-lamp.tsx` — 200 drooping cubic strands,
  slow sway, pointer attraction with wobble, tip twinkle.
- `src/components/play/variants/depth.tsx` — 3 parallax layers, no parting.
- `src/components/play/variants/silk-wave.tsx` — full-card fragment shader:
  one saturated silk ribbon, travelling sheen, eased pointer bend.
- `src/components/play/play-lab.tsx` — variant + phase pickers, keys 1–5,
  per-variant sliders, real-size card + Current reference card.
- `src/components/play/variants/settings.test.ts` — defaults inside slider ranges.

## Tokens

Day `#FFE97A / #A9D98B / #8FB0F0`; Dawn `#F2A0C8 / #E9786F / #F3C46B`;
Dusk `#9B8BE0 / #B49AE6 / #8FC3C9`; Night `#7F9BEA / #6670E0 / #E7A6E0`,
night background multiplied by 0.75, strands stay light.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; browser pass over
5 variants x 4 phases collecting console errors and screenshots.
