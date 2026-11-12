# Card + nav hover — decided from /dev/proto/card-hover

## Direction
Ring + nav bar: every card, and the whole nav bar, is one ring surface that grows
into its own box on hover and is lit by a cursor-following glow in the phase's
horizon palette. Promoted into /dev/prototype (ring-hover.css + ring-pointer.tsx).

## Final numbers
- Rest: the full Figma box on cards and the nav bar, no stroke; radius 12px (inner 11px).
- Grow: outward past the Figma box by 6px vertical / 3.5px horizontal per side,
  800ms, cubic-bezier(0.165, 0.84, 0.44, 1), clip-path only.
- Edge: 1px, held 1px outside the fill for the whole grow; fades in over 100ms
  on hover/focus and out after the 800ms clip closes.
- Glow: 614px radial, solid to 33% then out by 66%, horizon palette at 55% alpha.
- Follow: 1000ms, cubic-bezier(0.16, 1, 0.3, 1). Fade: 250ms linear.
- Title shift: 4.8px left / 4px up, same 800ms easing.
- z-index raise: 1, 100ms steps(1), so the hovered card paints over neighbours.
- Hover gated to (hover: hover) and (pointer: fine); no touch hover.
- Focus: :focus-visible on a link host and :has(:focus-visible) in the nav bar open
  the ring and light the glow; 2px primary outline, 2px off.
- Reduced motion: no growth, no shift, no z-index jump; the glow fades only.

## 2026-11-12 — Figma parity update

The original rest inset (6px / 3.5px) painted every card and the nav bar smaller
than its layout box: gaps read 21–26px instead of 12px and inner paddings read
15/13/11.5 instead of 22/20/16. The homepage frames define the resting surface
as the full card box with radius 12 and no stroke, so rest is now that box and
the ring grows outward into the gutters by the old inset amounts. The 1px edge
is held outside the fill for the whole grow and fades in over 100ms; tying its
width to the eased clip made it appear only in the second half of the 800ms and
read as sluggish. Reduced motion keeps the Figma box and reveals the edge
inside it.

## Rejected
- Lift — generic, least distinctive.
- Spotlight — barely visible on light phases.
- Focus — fading neighbours too heavy.
- Ring·subtle — lost the Stripe character.
- Ring with orb glow — user preferred the horizon palette.
- Ring + nav items — busy, too many small rings.
- Corner arrow — removed by the user.
- Stripe pink/purple glow — off-brand; use the phase palette.
