# Design system motion — 2026-11-13

The shipped motion of the theme toggle and the Day phase row, recorded from the merged code (PR #12, `5bbfba9`). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, `ease-in` for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` for the icon settle.
- Entrances stagger left to right; exits leave together. Nothing waits on the pointer.
- Hover never restarts the entrance: it replays the icon settle once from its resting pose and ends at rest.
- Reduced motion keeps the state change and drops the movement: one opacity fade, no icon motion.

## Theme toggle hover

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer over a segment | pill `transform` | 200ms | 0 | `cubic-bezier(0.2, 0.8, 0.2, 1)` | previous segment x → hovered segment x |
| Pointer over a segment | pill `opacity` | 150ms | 0 | `ease-out` | 0 → 0.55 |
| Pointer leaves the track | pill `opacity` | 150ms | 0 | `ease-out` | 0.55 → 0 |
| First segment entered | pill geometry | 0 | 0 | none | committed with transitions off, then restored on the next frame so the fade has a 0 start |
| Segment pressed | `scale` | 150ms | 0 | `ease-out` | 1 → 0.94 |
| Segment hover | `color` | 150ms | 0 | `ease-out` | `on-surface-variant` → `on-surface` |
| Segment or icon focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |

Hover only applies on `(hover: hover) and (pointer: fine)`; the pill is not shown on touch, where the row opens by tapping Day.

- `src/components/theme/theme-toggle.css:246` — hover-only block
- `src/components/theme/theme-toggle.css:252` — pill transition (transform 200ms, opacity 150ms)
- `src/components/theme/theme-toggle.css:248` — pill peak opacity 0.55
- `src/components/theme/theme-toggle.tsx:366` — first-entry geometry with transitions off
- `src/components/theme/theme-toggle.tsx:277` — `active:scale-[0.94]` and the 150ms `ease-out` segment transition
- `src/components/theme/theme-toggle.tsx:483` — tooltip fade

## Selection feedback

Moving the selection fades the incoming fill and label in over 150ms and releases the outgoing one on the same frame, so a fast flip can never paint two selected segments or two labels. The phase-switch fade in `globals.css` sets a transition on every element for one theme change; the segment and tooltip rules are specific enough to keep their own timings through it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection enters | fill `background-color` | 150ms | 0 | `ease-out` | transparent → `--toggle-selected` |
| Selection leaves | fill `background-color` | 0 | 0 | — | `--toggle-selected` → transparent |
| Segment focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |
| Segment blurred | tooltip `opacity` | 0 | 0 | — | 1 → 0 |
| Pointer enters a segment | tooltip `opacity` | 150ms | 300ms | `ease-out` | 0 → 1 |
| Pointer leaves a segment | tooltip `opacity` | 0 | 0 | — | 1 → 0 |

The enter-only timing is structural: the fill's transition is declared on the checked state and the label's on `:focus-visible`/`:hover`, so losing the state removes the transition instead of starting the reverse one. The phase-row entrance stagger delays only `opacity`/`translate`; colour, fill and scale are never delayed.

- `src/components/theme/theme-toggle.css:60` — row segment list, no fill
- `src/components/theme/theme-toggle.css:75` — row selected fill, enter-only
- `src/components/theme/theme-toggle.css:105` — stagger delays opacity/translate only
- `src/components/theme/theme-toggle.css:285` — mode segment feedback, enter-only fill
- `src/components/theme/theme-toggle.css:306` — tooltip hidden by default
- `src/components/theme/theme-toggle.css:310` — focused label fade-in
- `src/components/theme/theme-toggle.css:316` — hovered label, 300ms
- `src/components/theme/theme-toggle.css:323` — released label, no transition

## Day phase row entrance — "Stagger + icons"

The row is a 4-segment track (Clock · Dawn · Midday · Dusk) above the toggle. It scales out of the toggle, then the segments fade and rise left to right, then each icon settles 60ms after its own segment.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Row opens | `opacity` | 400ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 → 1 |
| Row opens | `transform` | 400ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | `scale(0.96)` → `none`, origin bottom right |
| Row opens | `visibility` | 0 | 0 | — | hidden → visible |
| Row closes | `opacity` | 240ms | 0 | `ease-in` | 1 → 0 |
| Row closes | `transform` | 240ms | 0 | `ease-in` | `none` → `scale(0.96)` |
| Row closes | `visibility` | 0 | 240ms | — | visible → hidden after the fade |
| Segment 1 (Clock) | `opacity`, `translate` | 360ms | 120ms | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 / `0 3px` → 1 / `0 0` |
| Segment 2 (Dawn) | `opacity`, `translate` | 360ms | 170ms | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 / `0 3px` → 1 / `0 0` |
| Segment 3 (Midday) | `opacity`, `translate` | 360ms | 220ms | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 / `0 3px` → 1 / `0 0` |
| Segment 4 (Dusk) | `opacity`, `translate` | 360ms | 270ms | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 / `0 3px` → 1 / `0 0` |
| Row closes | segment `opacity`, `translate` | 240ms | 0 | `ease-in` | 1 / `0 0` → 0 / `0 3px` |

The enter/exit durations are read from `--phase-row-exit-ms` so the component and the CSS cannot drift. While the row is open the nav is raised to `z-index: 2`, held through the 240ms exit.

- `src/components/theme/theme-toggle.css:25` — registered `--phase-row-exit-ms` (240)
- `src/components/theme/theme-toggle.css:36` — closed rest pose `scale(0.96)`, origin bottom right
- `src/components/theme/theme-toggle.css:46` — 400ms enter transition, 0s visibility
- `src/components/theme/theme-toggle.css:52` — 240ms `ease-in` exit, visibility delayed by the exit
- `src/components/theme/theme-toggle.css:61` — 360ms segment fade/rise
- `src/components/theme/theme-toggle.css:73` — stagger 120 / 170 / 220 / 270ms
- `src/components/theme/theme-toggle.css:87` — segment closed pose `0 3px`
- `src/components/theme/theme-toggle.css:9` — nav raise while open or exiting
- `src/components/theme/theme-toggle.tsx:23` — `PHASE_ROW_EXIT_MS = 240` fallback
- `src/components/theme/theme-toggle.tsx:550` — exit fallback timer, exit + 50ms

## Icon settle

Every phase icon arrives from an offset pose: the icon box grows from `scale(0.745)` while its rays, hands or sun swing or lift into place. The settle is 600ms with a small overshoot.

| Glyph | Part | Pose it settles from |
| --- | --- | --- |
| `day` — Midday | rays | `rotate(-76.5deg)` |
| `day` — Midday | icon box | `scale(0.745)` |
| `auto` — Auto clock | hands | `rotate(-102deg)` |
| `auto` — Auto clock | icon box | `scale(0.745)` |
| `dayclock` — the row's Clock | rays and hands | `rotate(-76.5deg)` / `rotate(-102deg)` |
| Dawn | sun | `translateY(6.8px)` (rises from below the horizon) |
| Dawn | icon box | `scale(0.745)` |
| Dusk | sun and rays | `translateY(-6.8px)` (sinks from above the horizon) |
| Dusk | icon box | `scale(0.745)` |
| Night (moon) | icon box | `rotate(-40deg) scale(0.745)` (hover replay only) |

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Row opens, segment 1 | `transform` | 600ms | 180ms | `cubic-bezier(0.34, 1.3, 0.64, 1)` | pose → `none` |
| Row opens, segment 2 | `transform` | 600ms | 230ms | `cubic-bezier(0.34, 1.3, 0.64, 1)` | pose → `none` |
| Row opens, segment 3 | `transform` | 600ms | 280ms | `cubic-bezier(0.34, 1.3, 0.64, 1)` | pose → `none` |
| Row opens, segment 4 | `transform` | 600ms | 330ms | `cubic-bezier(0.34, 1.3, 0.64, 1)` | pose → `none` |
| Icon hovered (row already open) | `transform` | 600ms | 0 | `cubic-bezier(0.34, 1.3, 0.64, 1)` | current or pose → `none`, plays once |

Icon delays are the segment delay + 60ms (120→180, 170→230, 220→280, 270→330). Hover replays the settle through the Web Animations API with `fill: none`, so it always ends at rest; if the animation is already mid-flight the current computed transform becomes the start. Hover is ignored while the row is still entering, and the entering flag is held for 990ms (330ms last delay + 600ms settle + 60ms) so a hover cannot stack a second animation.

- `src/components/theme/theme-toggle.tsx:59` — settle duration 600ms and `cubic-bezier(0.34, 1.3, 0.64, 1)`
- `src/components/theme/theme-toggle.tsx:61` — `scale(0.745)` pose
- `src/components/theme/theme-toggle.tsx:64` — hover poses per glyph, including Night `rotate(-40deg)`
- `src/components/theme/theme-toggle.tsx:94` — WAAPI `animate()` call, `fill: "none"`
- `src/components/theme/theme-toggle.tsx:358` — hover skip while entering or under reduced motion
- `src/components/theme/theme-toggle.tsx:20` — `ROW_ENTER_SETTLE_MS = 990`
- `src/components/theme/theme-toggle.css:97` — entrance poses only under `prefers-reduced-motion: no-preference`
- `src/components/theme/theme-toggle.css:101` — rays `rotate(-76.5deg)`
- `src/components/theme/theme-toggle.css:106` — hands `rotate(-102deg)`
- `src/components/theme/theme-toggle.css:111` — dawn sun `translateY(6.8px)`
- `src/components/theme/theme-toggle.css:124` — dusk sun and rays `translateY(-6.8px)`
- `src/components/theme/theme-toggle.css:129` — icon box `scale(0.745)`
- `src/components/theme/theme-toggle.css:158` — 600ms settle transition, first segment
- `src/components/theme/theme-toggle.css:203` — 600ms settle transition, last segment

## Row close

The row belongs to Day. It closes 100ms after the pointer leaves the region formed by Day, the 4px gap bridge and the row itself, so travel between toggle and row never closes it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer leaves Day + bridge + row | close timer | 100ms | 0 | — | scheduled → row exit starts |
| Keyboard focus inside the row | close timer | — | — | — | cancelled while focus stays inside |
| Escape | row | — | — | — | closes immediately, focus returns to Day |
| Leaving Day mode | row | — | — | — | closes immediately, no linger |

- `src/components/theme/theme-toggle.tsx:17` — `PHASE_ROW_CLOSE_DELAY_MS = 100`
- `src/components/theme/theme-toggle.tsx:609` — the close timer
- `src/components/theme/theme-toggle.tsx:600` — keyboard focus holds the row open
- `src/components/theme/theme-toggle.tsx:890` — hover region enter/leave
- `src/components/theme/theme-toggle.tsx:1004` — the gap bridge that keeps the region continuous

## Reduced motion

One opacity fade for the whole row. No scale, no segment rise, no icon settle, no press scale.

| Element | Behaviour |
| --- | --- |
| Row | opacity only, 120ms `ease-out`; `transform: none`; visibility delayed by the same 120ms |
| Segments | no opacity or translate animation; colour always transitions over 150ms, and the selected fill only on the way in |
| Icons | stay at rest; entrance poses and settles are inside `prefers-reduced-motion: no-preference` |
| Hover settle | skipped entirely; the pill still follows the pointer without the 200ms transform transition |
| Press | `scale: 1` (no 0.94 dip) |
| Frame-line spotlight | mask replaced by a whole-line opacity fade capped at 0.4 strength, 150ms |

- `src/components/theme/theme-toggle.css:276` — reduced-motion block
- `src/components/theme/theme-toggle.css:280` — `--phase-row-exit-ms: 120`
- `src/components/theme/theme-toggle.css:284` — 120ms opacity-only enter
- `src/components/theme/theme-toggle.css:311` — `scale: 1` on press
- `src/components/theme/theme-toggle.tsx:354` — settle skipped under reduced motion
- `src/components/home/frame-line-spotlight.tsx:207` — reduced spotlight path
- `src/components/home/frame-line-spotlight.css:39` — 150ms reduced fade

## Frame lines and spotlight

The four 1px page frame lines share one rest colour across all four phases: `#d4dce4`, written as `oklch(89% 0.0138 247.97)`. Hover spotlights keep each light phase's accent hue at full strength; Night uses its `primary` at 0.85.

| Phase | Rest line | Spotlight accent | Opacity |
| --- | --- | --- | --- |
| Dawn | `#d4dce4` | `oklch(64% 0.147 309.23)` ≈ `#a670cf` | 1 |
| Midday | `#d4dce4` | `oklch(64% 0.147 251.74)` ≈ `#3f8fe2` | 1 |
| Dusk | `#d4dce4` | `oklch(64% 0.146 63.06)` ≈ `#c97500` | 1 |
| Night | `rgb(255 255 255 / 0.08)` | `var(--primary)` | 0.85 |

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer moves near a line | spotlight mask and `--frame-spot-light` | per frame | 0 | `smoothstep` proximity, 80px catchment, 400px pool | 0 → sampled light |
| Light value changes | glow `opacity` | 160ms | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` | previous → sampled |

- `src/app/globals.css:294` — Midday `--frame-line`
- `src/app/globals.css:365` — Dawn `--frame-line`
- `src/app/globals.css:435` — Dusk `--frame-line`
- `src/app/globals.css:298` — Midday spotlight accent
- `src/app/globals.css:368` — Dawn spotlight accent
- `src/app/globals.css:438` — Dusk spotlight accent
- `src/app/globals.css:508` — Night spotlight `var(--primary)` at 0.85
- `src/components/home/frame-line-spotlight.css:36` — 160ms opacity transition
- `src/components/home/frame-line-spotlight.tsx:18` — proximity, pool radius and falloff constants

## Glyph clipping

Dawn and Dusk carry permanent `clipPath`s so the sun is masked by the horizon instead of drawn over it. The clips are static: they never animate, which is why the sun can rise or sink inside them.

| Glyph | Clip rect | Effect |
| --- | --- | --- |
| Dawn | `x 0 y 0 w 16 h 13` | hides the sun below the horizon while it rises; clears the 1.4px horizon stroke at y 11.3–12.7 |
| Dusk | `x 0 y 9.6 w 16 h 6.4` | hides the sun above the horizon while it sinks; clears the horizon stroke at y 9.8–11.2 |

- `src/components/theme/theme-toggle.tsx:173` — dawn clipPath
- `src/components/theme/theme-toggle.tsx:194` — dusk clipPath
- `src/components/theme/theme-toggle.tsx:134` — per-instance clip id from `useId`
