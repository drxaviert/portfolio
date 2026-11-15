# Design system tokens — 2026-11-14

Figma file `18bX1w3gLtGeKJ2KS2K2BT`. Sampled from the Design page sections: Dawn 121:3828, Day 121:1349, Dusk 121:5067, Night 121:2589.

## Collections

| Phase | Collection | Collection id |
| --- | --- | --- |
| Dawn | Color · Dawn | VariableCollectionId:131:10670 |
| Day | Color · Light (manual rename to "Color · Day" pending) | VariableCollectionId:102:1699 |
| Dusk | Color · Dusk | VariableCollectionId:131:10692 |
| Night | Color · Dark (manual rename to "Color · Night" pending) | VariableCollectionId:102:1697 |

## Colour roles

| Role | Dawn | Day | Dusk | Night |
| --- | --- | --- | --- | --- |
| `surface` | #E5E5E5 | #E5E5E5 | #E5E5E5 | #0D0D0D |
| `surface-dim` | #D9D9D9 | #D9D9D9 | #D9D9D9 | #000000 |
| `surface-bright` | #FFFFFF | #FFFFFF | #FFFFFF | #333333 |
| `surface-container-low` | #FFFFFF | #FFFFFF | #FFFFFF | #191919 |
| `surface-container` | #F2F2F2 | #F2F2F2 | #F2F2F2 | #262626 |
| `surface-container-high` | #E5E5E5 | #E5E5E5 | #E5E5E5 | #333333 |
| `surface-container-highest` | #D9D9D9 | #D9D9D9 | #D9D9D9 | #404040 |
| `on-surface` | #0D0D0D | #0D0D0D | #0D0D0D | #F2F2F2 |
| `on-surface-variant` | #4C4C4C | #4C4C4C | #4C4C4C | #B2B2B2 |
| `outline` | #999999 | #999999 | #999999 | #666666 |
| `outline-variant` | #000000 @8% | #000000 @8% | #000000 @8% | #FFFFFF @8% |
| `primary` | #D19EF9 | #3687D9 | #F0B075 | #FD6850 |
| `on-primary` | #FFFFFF | #FFFFFF | #FFFFFF | #0D0D0D |
| `secondary` | #EDD8FC | #3093F8 | #F9E0C8 | #F73131 |
| `tracker/0` | #FBF6FE | #F3F8FC | #FEF8F2 | #241D1C |
| `tracker/1` | #F5EAFE | #E4EFF9 | #FCEEE1 | #342220 |
| `tracker/2` | #EDD8FC | #CDE2F4 | #F9E0C8 | #4B2A25 |
| `tracker/3` | #E1C0FB | #AED0ED | #F5CCA6 | #6B352D |
| `tracker/4` | #D19EF9 | #81B6E2 | #F0B075 | #9D4739 |
| `toggle/track` | #E5E5E5 | #E5E5E5 | #E5E5E5 | #0D0D0D |
| `toggle/selected` | #FFFFFF | #FFFFFF | #FFFFFF | #333333 |

Light phases (Dawn, Day, Dusk) share the same surface/text shell; only `primary`, `secondary` and `tracker/*` differ. `primary` is the phase accent (tracker/4), `secondary` is tracker/2.

## Primitive tier

Every role above resolves to a primitive, never a raw hex. Primitives live on `:root` in `src/app/globals.css` as `--palette-<hue>-<step>`; steps are ordered by lightness inside a family (not a shared cross-family scale). Alpha overlays are their own primitives.

| Family | Steps | Used for |
| --- | --- | --- |
| `--palette-neutral-*` | 50–800 | surfaces, text, outlines, Night surfaces |
| `--palette-blue-*` | 50–800 | Day accent and tracker ramp, cool horizon tints, Day/Night play |
| `--palette-violet-*` | 50–800 | Dawn accent and tracker, Dusk/Night play, Night horizon cast |
| `--palette-rose-*` | 50–200 | Dawn horizon and orb pink, Night play |
| `--palette-red-*` | 50–400 | Night accent, secondary and tracker browns |
| `--palette-amber-*` | 50–800 | Dusk accent and tracker, warm horizon tints, Day/Dawn play |
| `--palette-green-*`, `--palette-teal-*` | 50 | Day play green, Dusk play teal, Night horizon mint |
| `--palette-black-a8`, `--palette-white-a8` | — | `outline-variant`, Night `frame-line` |

`@property` initial-values cannot take `var()`, so the registered horizon/orb initial values stay literal; they mirror the Day primitives (commented in place).

## Elevation

| Token | Day / Dawn / Dusk | Night |
| --- | --- | --- |
| `--shadow-card` | `0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04)` | `0 0 0 1px rgb(255 255 255 / 0.08)` |

Applied with the `shadow-card` utility (`@utility shadow-card`, `globals.css`). Cards and menus never get a stroke; the 1px ring inside the shadow is the card edge.

## Radius

| Token | Value | Where |
| --- | --- | --- |
| `--radius-xs` | 2px | tracker cells |
| `--radius-sm` | 0.25rem (4px) | small chips |
| `--radius-md` | 0.5rem (8px) | menu rows, nav capsule |
| `--radius-lg` | 0.75rem (12px) | cards, nav bar, menus |

The ring surface uses `--radius-lg` outside and `calc(var(--radius-lg) - 1px)` for the inner fill.

## Type

| Token | Value | Where |
| --- | --- | --- |
| `--text-xs` … `--text-4xl` | 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25rem | body and UI steps |
| `--text-title` | 2.5rem / 2.75rem, tracking -0.4px | highlight card title, ≥768 |
| `--text-title-sm` | 2rem / 2.2rem, tracking -0.4px | highlight card title, 375 |
| `--font-sans` | Work Sans → system sans | whole app |

## Horizon, play and orb

| Token | Role |
| --- | --- |
| `--horizon-base`, `--horizon-mid`, `--horizon-mid-at`, `--horizon-3` | page base, mid stop and its percentage, tinted bottom edge |
| `--horizon-1`, `--horizon-2`, `--horizon-1-alpha`, `--horizon-2-alpha` | bottom-corner blob hues and alphas |
| `--horizon-ring-glow` | the same hues at ring strength, per phase |
| `--horizon-blob-*`, `--horizon-blob-blur` | blob geometry and blur (phase-independent) |
| `--horizon-transition-duration`, `--horizon-transition-ease` | click-driven crossfade (400ms) |
| `--phase-auto-transition-duration`, `--phase-auto-transition-ease` | clock-driven crossfade (4000ms) |
| `--orb-gradient`, `--orb-1`, `--orb-2`, `--orb-2-at`, `--orb-3` | nav orb head gradient |
| `--play-bg-top`, `--play-bg-mid`, `--play-base`, `--play-bg-bottom`, `--play-strand`, `--play-glow` | play card fan and horizon band; `--play-bg-bottom` aliases `--play-base` |

Play card stops per phase:

| Phase | top | mid | base | strand | glow |
| --- | --- | --- | --- | --- | --- |
| Day | #FFE97A | #A9D98B | #8FB0F0 | #FFFDF4 | #FFF8D4 |
| Dawn | #F2A0C8 | #E9786F | #F3C46B | #FFF8F4 | #FFE3D6 |
| Dusk | #9B8BE0 | #B49AE6 | #8FC3C9 | #FDFBFF | #EFE7FF |
| Night | #7F9BEA | #6670E0 | #E7A6E0 | #EEF0FF | #C9CCFF |

Nav orb stops per phase:

| Phase | `--orb-1` | `--orb-2` @ | `--orb-3` |
| --- | --- | --- | --- |
| Day | #60A8E2 | #0071C1 @ 100% | #0071C1 |
| Dawn | #FF90B9 | #CB83FF @ 100% | #CB83FF |
| Dusk | #B4D8FF | #F7C1D9 @ 50% | #FFB451 |
| Night | #D6B49D | #FD6850 @ 45% | #FD6850 |

## Theme components (Components page, section "Theme controls" 131:10728)

| Set | Set id | Variant | Variant id |
| --- | --- | --- | --- |
| Theme toggle | `131:10813` | selected=Day, look=Light | `131:10755` |
| Theme toggle | `131:10813` | selected=Night, look=Light | `131:10756` |
| Theme toggle | `131:10813` | selected=Auto, look=Light | `131:10770` |
| Theme toggle | `131:10813` | selected=Day, look=Night | `131:10784` |
| Theme toggle | `131:10813` | selected=Night, look=Night | `131:10798` |
| Theme toggle | `131:10813` | selected=Auto, look=Night | `131:10812` |
| Theme button | `131:10874` | look=Light, open=false | `131:10819` |
| Theme button | `131:10874` | look=Light, open=true | `131:10843` |
| Theme button | `131:10874` | look=Night, open=false | `131:10849` |
| Theme button | `131:10874` | look=Night, open=true | `131:10873` |
| Theme menu | `131:10989` | look=Light, selected=Day | `131:10893` |
| Theme menu | `131:10989` | look=Light, selected=Night | `131:10912` |
| Theme menu | `131:10989` | look=Light, selected=Auto | `131:10931` |
| Theme menu | `131:10989` | look=Night, selected=Day | `131:10950` |
| Theme menu | `131:10989` | look=Night, selected=Night | `131:10969` |
| Theme menu | `131:10989` | look=Night, selected=Auto | `131:10988` |

Toggle: 104×32, segments Day · Night · Auto, 16px icons at stroke 1.4, radius 8. Button: 32×32. Menu: 168×132, radius 12, no stroke.

## Card and nav surface (ring hover)

Every card and the nav bar is one ring surface: a fill plus a 1px edge. The fill
uses `surface-container-low`; the edge uses `frame-line`. Figma defines the
resting card at its full layout box, so that is what the code paints at rest.

| Property | Value |
| --- | --- |
| Rest surface | the full Figma layout box (no inset) |
| Radius | 12px outer, 11px inner fill; no per-corner overrides |
| Rest stroke | none (the 1px edge is transparent at rest) |
| Hover growth | outward past the Figma box by 6px vertical / 3.5px horizontal per side, into the 12px gutters |
| Transition | 800ms `cubic-bezier(0.165, 0.84, 0.44, 1)`, clip-path only |
| Edge | 1px `frame-line`, held 1px outside the fill for the whole grow; fades in over 100ms on hover/focus and out 100ms after the 800ms clip closes |
| Glow | 614px radial in the phase horizon palette; follows the pointer over 1000ms, fades over 250ms |
| Raise | `z-index: 1` on the hovered host, 100ms `steps(1)`, so it paints over neighbours |
| Focus | `:focus-visible` on a link host and `:has(:focus-visible)` in the nav bar; 2px `primary` outline, 2px offset |
| Reduced motion | outer box stays the Figma box; no growth, title shift or z-index jump; the edge is revealed inside the box and the glow only fades |

### Theme menu at 375

| Property | Value |
| --- | --- |
| Surface | 168×132, radius 12, no stroke, `surface-container-low`, `shadow-card` |
| Padding | 4px around the rows |
| Row | 40px high, 2px gap between rows, 12px horizontal padding, radius 8 |
| Row fill | selected `surface-container-high`; hover `surface-container` |
| Icon → label | 8px gap, 16px icon |
| Label | 16px / 20px, weight 500; `on-surface` selected, `on-surface-variant` otherwise |
| Anchor | opens upward, 8px above the 32×32 button, right-aligned to it |
| Position | y 716–848 in the 375×920 frame, fully on screen and unclipped |

## Design System page 102:1322

Rows at x=0, 400px gaps: phase colour table (y 4444, 84 swatches bound to the four collections), shadow specimens (y 6556), theme controls (y 7336).

## See also

- [motion.md](./motion.md) — the shipped motion of the theme toggle and the Day phase row: hover, entrances, icon settle, close delay, reduced motion, and the frame-line spotlight values.

