# Handoff: frame-line hover prototype (2026-11-11 late session)

## Done before this
- PR #2 merged into main (`751318d`): phase fade, boundary timer, glow tuner, horizon glow on home, prototype promoted to `/` (shared parts in `src/components/home/`), plus 6 review fixes. Branch `feat/phase-horizon-glow` was deleted locally and on GitHub.
- New memory `clear-commit-messages`: every commit needs a body covering what changed, why, and the root cause of any fix.

## Goal now
Hover animation for the four 1px **page frame lines** (`src/components/home/home-layout.tsx:30-49`). They only show at 1440px and wider: two full-height verticals at the 1200px frame edges, and two 1200px-wide horizontals 64px above the top card and below the nav. The colour is `--frame-line`. Today they are static and `pointer-events-none`. This is NOT the per-card `.ring-frame` outline, which already grows on hover (`ring-hover.css`).

## Decisions (user)
- Trigger: the cursor coming **near** a line. The proximity zone I proposed is 24px either side, perpendicular, within the line's length.
- Prototype all 4 directions behind a live picker (emil-prototype skill), plus the static baseline:
  1. Spotlight: a ~160px brighter segment follows the cursor along the line. This was my pick: calm, and it matches the card glow.
  2. Darken: the whole line deepens over ~250ms.
  3. Bend: an SVG line bows toward the cursor up to ~8px, then springs back.
  4. Draw: nearly invisible at rest, draws outward from the point nearest the cursor.
- Reduced motion: opacity fade only. Touch: none (hover:hover + pointer:fine only).

## Current state
- **Integrated.** Spotlight ships as `src/components/home/frame-line-spotlight.tsx` + its CSS, rendered by `HomeLayout` over the four real `[data-frame-line]` spans. Values: proximity 80px, R 200px (length 400), brightness 0.85, bleed falloff 3, junction snap 48px, blend softness 120px, `--primary` colour. The shared-light round pool, one rAF pointer listener, hover/fine gating and reduced-motion fade are preserved.
- **Short-screen gap fix:** the nominal frame (780px content + 2 x 64px gaps = 908px) overflowed a 900px viewport. `home-layout.tsx` now sets `--frame-gap: clamp(0px, (100dvh - 780px) / 2, 64px)` on the frame container and the horizontals use it; at 1440x900 the gap is 60px and both horizontals are on screen (900/900, no scroll), while 1920x1080 keeps 64px unchanged.
- **Prototype deleted** with user approval: `src/app/dev/proto/frame-lines/` (6 files) is gone, including the CSS that hid the production root there. `src/app/dev/proto/` still contains `work-carousel`.


## Gotchas
- Use `pnpm.cmd` (the pnpm.ps1 execution policy is blocked). The dev server is on :3000. `pnpm build` needs the dev server stopped (EBUSY on `.next/dev-server.log`).
- Lines only render at 1440px+, so test at 1440x900 and 1920x1080. 1440x900 now fits exactly 900/900px, with no room to spare.

## Next
1. Review the integrated spotlight on `/` at 1440x900 and 1920x1080, Day and Night.
2. Later: real homepage content (copy, projects, tracker data) and a pre-launch pass with `emil-prep-for-prod`.

## Decision (2026-11-12)

Chosen: **Spotlight** (variant 2). Integrated into HomeLayout as
`src/components/home/frame-line-spotlight.tsx` plus its CSS.

Values: proximity 80px, speed 1×, strong ease-out, length 400px (radius 200),
brightness 0.85, bleed falloff 3.0, junction snap 48px, blend softness 120px,
colour `--primary` (Day blue / Night orange-red).

Model: one shared light point L (weighted cursor projections, plus a junction
blend). Every line samples the same round pool of radius R: peak
`falloff(d/R)` and a mask extent equal to the chord `sqrt(R² - d²)`, with a
gaussian bleed. All arms carry the same circle, so crossing lines light
continuously and no arm is cut off at a corner.

Rejected: Darken (too subtle in Day); Bend and Draw (not chosen).

Note: proximity, length and blend softness were left at the slider maximum.
The prototype route `src/app/dev/proto/frame-lines/` is kept until the user
approves deleting it.

