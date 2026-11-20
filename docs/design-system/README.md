# Design system — current values as built (2026-11-18)

This directory records the values the site uses **today**, read from the source. Nothing here is a
proposal: every number is the one in the code, including values that do not sit on a tidy scale.

- [color.md](./color.md) — CSS custom properties and theme tokens per phase, primitives, resolved
  colours, and non-token colour literals.
- [typography.md](./typography.md) — families, sizes, weights, line-heights, letter-spacing.
- [spacing-layout.md](./spacing-layout.md) — gaps, paddings, frame and nav geometry, carousel unit,
  masks, reader geometry, breakpoints, and the calc/var chains that derive one value from another.
- [radii-shadows-borders.md](./radii-shadows-borders.md) — radius tokens and literals, `shadow-card`
  and the other shadows, every border and focus outline.
- [components.md](./components.md) — the nav, theme toggle (Day · Night · Auto and the Day-phase row),
  home cards and tracker widget, work drawer and carousel: key dimensions, the tokens each reads, and
  the shared z-index order.
- [media.md](./media.md) — the `<Media>` frame and its manifest: slots, aspect ratios, image and
  video behaviour, autoplay and reduced motion, posters, alt text, audio, and what fails the build.
- [motion-tokens.md](./motion-tokens.md) — `--ease-*` and `--duration-*` exactly as defined, their
  component aliases, and the literal curves and durations that recur.
- [tokens.md](./tokens.md) — the 2026-11-14 record, sampled from Figma (colour roles, elevation,
  radius, type, horizon/orb stops, theme components).
- [motion.md](./motion.md) — the 2026-11-13 record of shipped motion, choreography by component.

## How this was produced

Values were read from `src/app/globals.css`, the component CSS under `src/components`, and the TS
constants that own timings and geometry (`carousel-settings.ts`, `carousel-math.ts`, `hover-peek.ts`,
`edge-blur.ts`, `morph.ts`, `carousel-step.ts`, `theme-toggle.tsx`). Source references are
`path:line` from the repository root.

## Scope

- Shipped UI only. The `/dev/*` prototype routes and their CSS (`src/app/dev/proto/…`) are not
  recorded.
- WebGL/GLSL is out of scope. The only shader source is the inline `FRAGMENT_SOURCE` in
  `src/components/horizon/horizon-shader.tsx:75`; the CSS fallback it sits over is recorded in
  `color.md` (horizon tokens) and `spacing-layout.md` (blob geometry).
- `tokens.md` came from Figma and `motion.md` from an earlier reading of the code. Where either
  disagrees with today's source, the disagreement is listed in `color.md` (Figma-sampled values) and
  `motion-tokens.md` (motion). Neither file was edited.

## Phase model

`src/lib/theme.ts` defines `Mode = "day" | "night" | "auto"` and
`Phase = "dawn" | "day" | "dusk" | "night"`, with clock starts at 05 / 08 / 17 / 20
(`PHASE_STARTS`, `src/lib/theme.ts:25-30`). The pre-paint script sets `data-mode` and `data-phase`
on `<html>`; `:root` alone is the no-script fallback and carries the Day values
(`src/app/globals.css:379-380`). There is no separate "dim" theme: `surface-dim` is a colour role that
resolves darker in Night.
