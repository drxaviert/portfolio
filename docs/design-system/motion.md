# Design system motion — 2026-11-13

The shipped motion of the theme toggle, the Day phase row and the home nav's Glide capsule, recorded from the merged code (PR #12, `5bbfba9`; nav at `d574d89`). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, `ease-in` for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` for the icon settle.
- A theme change is one crossfade of the whole page, not a colour transition per element: everything changes on the same frame because it is the same image pair.
- Entrances stagger left to right; exits leave together. Nothing waits on the pointer.
- Hover never restarts the entrance: it replays the icon settle once from its resting pose and ends at rest.
- Reduced motion keeps the state change and drops the movement: one opacity fade, no icon motion.

## Theme toggle hover

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer over a segment | hover path `d` | 180ms / 220ms | 0 / 120ms | ease-out cubic / quint | previous hover edge → hovered segment |
| Pointer over a segment | hover layer `opacity` | 150ms | 0 | `ease-out` | 0 → 0.55 |
| Pointer leaves the track | hover layer `opacity` | 150ms | 0 | `ease-out` | 0.55 → 0 |
| First segment entered | hover path | 0 | 0 | none | placed at the hovered segment, then faded in from 0 |
| Segment pressed | `scale` | 150ms | 0 | `ease-out` | 1 → 0.96 |
| Segment hover | `color` | 150ms | 0 | `ease-out` | `on-surface-variant` → `on-surface` |
| Segment or icon focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |

Hover only applies on `(hover: hover) and (pointer: fine)`; the hover capsule is not shown on touch, where the row opens by tapping Day. Its motion is the same stretch & snap shape as the selection (see that section).

- `src/components/theme/theme-toggle.css:433` — hover layer opacity and 0.55
- `src/components/theme/theme-toggle.css:439` — hover-only visible state
- `src/components/theme/theme-toggle.tsx:70` — fine-pointer gate for the hover capsule
- `src/components/theme/theme-toggle.tsx:639` — pointer-over drives the hover path
- `src/components/theme/theme-toggle.tsx:407` — hover uses the same path runner
- `src/components/theme/theme-toggle.tsx:576` — `active:scale-[0.96]` and the 150ms `ease-out` segment transition
- `src/components/theme/theme-toggle.css:310` — tooltip fade

## Theme change

Switching mode (or crossing a clock boundary in Auto/Day) replaces the colour tokens on `<html>`. That one change is animated as a **single crossfade of the whole page**: `src/lib/theme.ts` applies the write inside `document.startViewTransition()`, and the browser snapshots the page before and after it and blends the two images itself. Nothing animates a colour per element, so the horizon, the cards, the text, the nav, the toggle and the phase row are inside one image pair and start and finish together by construction — and the fade costs two captures instead of a full-page repaint on every frame.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Mode click, phase change | whole-page snapshot `opacity` | 400ms | 0 | `ease-in-out` | old snapshot 1 → 0 over the new one |
| Clock-driven change (Auto / Day) | whole-page snapshot `opacity` | 4000ms | 0 | `ease-in-out` | same |
| Reduced motion | whole-page snapshot `opacity` | 150ms | 0 | `ease-in-out` | same |
| No View Transitions API | — | 0 | — | — | instant switch, one frame |
| Phase row opened by the same click | see "Day phase row entrance" | + crossfade duration | — | — | entrance waits for the crossfade |

Details that keep it one piece:

- **The page is a snapshot for the fade.** The live document is not painted (and stops receiving hit tests) for the crossfade, so anything that starts animating on the same click would play invisibly. The row's entrance therefore waits for the crossfade (`--phase-enter-delay`), and the two hover surfaces ignore the phantom pointer-leave it causes (`isPhaseSwitching()`), so the nav capsule and the row keep their state and recover on the next real pointer event.
- **No per-element colour transitions.** The old blanket rule (`:root[data-phase-switching] *`) and the twelve inherited `--horizon-*` / `--orb-*` token transitions were removed. Measured on the 1440x900 home page they cost 9-10ms of style recalc *per frame* and 8-11 dropped frames per switch; the crossfade measures 0.
- **The glow switches in the same frame as the snapshot.** The shader reads the tokens on the `data-phase` mutation, so it draws once with the new palette inside the rendering update that the browser snapshots — no late glow, no texture rebuild, no per-frame token read.
- **The selection capsule crossfades with the page** when the theme changes, instead of flying: a snapshot cannot contain live motion. It still runs the full stretch & snap on every selection change that is not a theme change (the Day phase row, and Day/Night/Auto when the theme is already that mode).
- `data-phase-switching` stays on `<html>` for the length of the crossfade and carries the kind (`click` / `auto`), which is what selects the duration in CSS.

- `src/lib/theme.ts:334` — the crossfade runner (snapshot, write, announce, settle)
- `src/lib/theme.ts:256` — `isPhaseSwitching()`, the "the page is a snapshot" predicate
- `src/app/globals.css:103` — `::view-transition-old(root)` fade and the 400ms / auto tokens
- `src/app/globals.css:16` — why the tokens are no longer transitioned
- `src/components/theme/theme-toggle.css:49` — `--phase-enter-delay` holds the row entrance
- `src/components/horizon/horizon-shader.tsx:621` — one draw per token mutation
- `src/components/home/nav-items.tsx:397` — hover kept through the crossfade

## Selection feedback

Selection is painted by the stretch highlight (next section); the segment itself no longer carries a fill in the default path, so a fast flip can never paint two selected segments. The incoming label still fades over 150ms and is released on the same frame. A theme change is a page-wide crossfade (see "Theme change"), so it does not retime any of these rules.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection enters, reduced motion | fill `background-color` | 120ms | 0 | `ease-out` | transparent → `--toggle-selected` |
| Segment focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |
| Segment blurred | tooltip `opacity` | 0 | 0 | — | 1 → 0 |
| Pointer enters a segment | tooltip `opacity` | 150ms | 300ms | `ease-out` | 0 → 1 |
| Pointer leaves a segment | tooltip `opacity` | 0 | 0 | — | 1 → 0 |

The fill row is the reduced-motion path only; the default highlight hides its layer and crossfades that fill in 120ms. The label fade is declared on `:focus-visible`/`:hover`, so losing the state removes the transition instead of starting the reverse one. The phase-row entrance stagger delays only `opacity`/`translate`; colour and scale are never delayed.

- `src/components/theme/theme-toggle.css:458` — reduced-motion fill crossfade (120ms)
- `src/components/theme/theme-toggle.css:306` — tooltip hidden by default
- `src/components/theme/theme-toggle.css:310` — focused label fade-in
- `src/components/theme/theme-toggle.css:316` — hovered label, 300ms
- `src/components/theme/theme-toggle.css:323` — released label, no transition

## Selection highlight — stretch & snap

Both radiogroups (Day/Night/Auto and the Day phase row) paint the selection with one SVG capsule inside the track instead of a per-segment fill. On a change the leading edge leaves first; the trailing edge holds for the lag, so the capsule spans both segments and then contracts onto the target with no overshoot. The edges are retargeted from the shape's current position, so a fast flip never restarts from zero and a second selection mid-flight stays the only destination. The layer is exactly the track box, so nothing paints outside it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection moves, leading edge | highlight path `d` | 180ms | 0 | ease-out cubic, `1-(1-t)^3` | current edge → destination edge |
| Selection moves, trailing edge | highlight path `d` | 220ms | 120ms | ease-out quint, `1-(1-t)^5` | current edge → destination edge |
| Selection moves (Day phase row) | same as above | 180ms / 220ms | 0 / 120ms | same | current edge → destination edge |
| Hover moves between segments | hover path `d` | 180ms / 220ms | 0 / 120ms | same | previous hover edge → hovered segment |
| Hover pill appears | hover layer `opacity` | 150ms | 0 | `ease-out` | 0 → 0.55 |
| Hover pill leaves | hover layer `opacity` | 150ms | 0 | `ease-out` | 0.55 → 0 |
| Selection enters, reduced motion | fill `background-color` | 120ms | 0 | `ease-out` | transparent → `--toggle-selected` |

The timings are the shipped constants `LEADING_DURATION_MS = 180`, `TRAILING_DURATION_MS = 220` and `TRAILING_DELAY_MS = 120`; the rest silhouette is the Figma 34x28 pill at a 6px radius, 2px inside the track. Hover runs the same shape at the documented 0.55 weight and is gated to `(hover: hover) and (pointer: fine)`. Reduced motion hides the layer and keeps the 120ms fill crossfade.

- `src/components/theme/theme-toggle.tsx:303` — `TRAILING_DELAY_MS = 120`
- `src/components/theme/theme-toggle.tsx:304` — `LEADING_DURATION_MS = 180`
- `src/components/theme/theme-toggle.tsx:305` — `TRAILING_DURATION_MS = 220`
- `src/components/theme/theme-toggle.tsx:311` — leading ease-out cubic
- `src/components/theme/theme-toggle.tsx:315` — trailing ease-out quint
- `src/components/theme/theme-toggle.tsx:324` — rest pill path (34x28, radius 6)
- `src/components/theme/theme-toggle.tsx:407` — the one-path runner and its rAF loop
- `src/components/theme/theme-toggle.css:414` — clipped track-sized highlight layer
- `src/components/theme/theme-toggle.css:433` — hover layer opacity and 0.55
- `src/components/theme/theme-toggle.css:458` — reduced-motion layer hide + fill crossfade

## Nav hover (Glide)

The home nav's three labels and the design-system glyph share one capsule instead of each carrying its own hover fill. The glyph is the fourth target of the same run — the capsule crosses the divider to it and back — and the run sits to the right of the orb head, which the capsule never reaches. The nav keeps the selection highlight's stretch & snap shape but not its implementation: it is a state-driven pair of springs (below), not the toggle's fixed-duration flight, because a pointer can retarget it faster than a flight can finish. The toggle's own 180 / 120 + 220 motion is unchanged.

The capsule is two edges, each its own damped spring (`src/components/home/glide-spring.ts`). A move only changes where the springs are heading, so both edges keep their current position **and** velocity: the pill can be redirected mid-flight the way a CSS transition retargets, instead of replaying a flight from a stored start. Nothing snaps while the pointer is inside the run, and `data-visible` (the "pointer is in the run" state) is never removed by a move.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Hover moves, leading edge | capsule `clip-path` | ~185ms to rest | 0 | spring `k=1100`, `ζ=0.9` | current edge → target edge |
| Hover moves, trailing edge | capsule `clip-path` | ~205ms to rest | 100ms from rest | spring `k=900`, `ζ=0.9` | current edge → target edge |
| Hover moves mid-flight | both edges | remaining spring travel | not re-armed | same springs, new target | current edge and velocity → new target edge |
| Reversing mid-flight | both edges | as above | 0 | same springs, roles swap | current edge and velocity → target edge |
| First item entered | capsule layer `opacity` | 150ms | 0 | `ease-out` | 0 → 0.55, placed on the item with no travel |
| Pointer leaves the run | capsule layer `opacity` | 150ms | 0 | `ease-out` | 0.55 → 0 |
| Move across `data-glide-break` | capsule layer `opacity` | 150ms out, 150ms in | 0 | `ease-out` | fades out where it is, re-places while blank, fades back in |
| Item hovered | item `color` | 150ms | 0 | `ease-out` | `on-surface-variant` → `on-surface` |
| Item pressed | `scale` | 150ms | 0 | `ease-out` | 1 → 0.96 |
| Glyph hovered | tooltip `opacity` | 150ms | 300ms | `ease-out` | 0 → 1 |
| Glyph focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |
| Hover enters, reduced motion | item fill `background-color` | 120ms | 0 | `ease-out` | transparent → 55% `surface-container` |

Spring constants, from `glide-spring.ts`: `GLIDE_LEAD_SPRING = { stiffness: 1100, dampingRatio: 0.9 }`, `GLIDE_TRAIL_SPRING = { stiffness: 900, dampingRatio: 0.9 }`. The runner steps them by the frame's `dt`, clamped to `GLIDE_MAX_STEP_S = 1/30`, and treats an edge as at rest under `GLIDE_REST_PX = 0.4` and `GLIDE_REST_VELOCITY = 12` px/s, then stops the rAF loop. The step is the closed-form solution of the oscillator, so the path does not depend on how the interval is split.

The leading edge is whichever edge points the way the pill is travelling and gets the stiff spring; the trailing edge gets the soft one. A move from rest also holds the trailing edge for `TRAIL_HOLD_MS = 100` so the capsule stretches out of the old item before it closes. The hold is never re-armed by a retarget and is dropped when the direction reverses, so a fast sweep can never freeze the trail. Measured against the toggle's curve, a single move still peaks at the same width within a couple of pixels and settles by ~300ms.

`data-glide-break` cuts the run: the capsule never stretches across the divider, so a move across it sets `data-fading` (fade out in place), re-places while blank and fades back in. `data-visible` is not touched by that, so the trace still reads "in the run" throughout. A retarget during the fade only updates the pending destination — the timer is never restarted — so a sweep cannot leave the capsule hidden; a pointer that leaves during the fade cancels the re-place.

A frame writes one property: the capsule keeps the run's width and carries the pill as a `clip-path` inset, so the edges move independently while no width or other layout property changes. At rest the pill is the hovered item's box at the `--radius-md` token. Hover is gated to `(hover: hover) and (pointer: fine)`, focus is a 2px `primary` ring on the item, and Work keeps `aria-current="page"`. Reduced motion hides the capsule: the hovered item carries the 55% `surface-container` fill and crossfades it in 120ms with no travel, so the state change survives without the movement.

- `src/components/home/glide-spring.ts:32` — lead spring `k=1100`, `ζ=0.9`
- `src/components/home/glide-spring.ts:43` — trail spring `k=900`, `ζ=0.9`
- `src/components/home/glide-spring.ts:52` — frame clamp `1/30`
- `src/components/home/glide-spring.ts:55` — rest thresholds
- `src/components/home/glide-spring.ts:82` — closed-form edge step (retarget keeps `v0`)
- `src/components/home/nav-items.tsx:40` — break fade, matched to the CSS 150ms
- `src/components/home/nav-items.tsx:45` — `TRAIL_HOLD_MS = 100`
- `src/components/home/nav-items.tsx:90` — the one capsule runner shared by every item
- `src/components/home/nav-items.tsx:125` — `data-glide-break` detection
- `src/components/home/nav-items.tsx:162` — the only snap paths: entry and break re-place
- `src/components/home/nav-items.tsx:176` — per-frame spring step and `clip-path` write
- `src/components/home/nav-items.tsx:240` — break: fade out, re-place, fade in; timer never restarted
- `src/components/home/nav-items.tsx:266` — pointer left the run: fade out, keep the edges
- `src/components/home/nav-items.tsx:299` — real entry: place, no travel
- `src/components/home/nav-items.tsx:336` — direction, hold arming, reversal
- `src/components/home/nav-items.tsx:380` — the item run: labels, divider, glyph as the fourth target
- `src/components/home/nav-items.css:19` — press `scale: 0.96`, 150ms `ease-out`
- `src/components/home/nav-items.css:61` — hover weight 0.55
- `src/components/home/nav-items.css:64` — `data-fading` blanks the capsule for a break
- `src/components/home/nav-items.css:83` — glyph tooltip, 300ms delay
- `src/components/home/nav-items.css:111` — reduced-motion capsule hide
- `src/components/home/nav-items.css:119` — reduced-motion 55% fill crossfade

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
- `src/components/theme/theme-toggle.css:41` — `--phase-enter-delay`, raised to the crossfade duration during a theme change
- `src/components/theme/theme-toggle.css:55` — 400ms enter transition, delayed by `--phase-enter-delay`
- `src/components/theme/theme-toggle.css:62` — 240ms `ease-in` exit, visibility delayed by the exit
- `src/components/theme/theme-toggle.css:72` — 360ms segment fade/rise
- `src/components/theme/theme-toggle.css:85` — stagger 120 / 170 / 220 / 270ms
- `src/components/theme/theme-toggle.css:99` — segment closed pose `0 3px`
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

The theme change keeps its crossfade — a colour change is not motion — but at 150ms instead of 400ms. Everything else drops movement: one opacity fade for the whole row, no scale, no segment rise, no icon settle, no press scale.

| Element | Behaviour |
| --- | --- |
| Theme change | same whole-page crossfade, 150ms `ease-in-out` (`--horizon-transition-duration`) |
| Row | opacity only, 120ms `ease-out`; `transform: none`; visibility delayed by the same 120ms |
| Selection highlight | layer hidden; the segment fill crossfades over 120ms and the label colour over 150ms |
| Segments | no opacity or translate animation; colour always transitions over 150ms |
| Icons | stay at rest; entrance poses and settles are inside `prefers-reduced-motion: no-preference` |
| Hover capsule | hidden; the segment fill is the only hover feedback, following the pointer without travel |
| Nav hover capsule | hidden; the hovered nav item carries the 55% `surface-container` fill over 120ms, no travel |
| Press | `scale: 1` (no 0.96 dip) |
| Frame-line spotlight | mask replaced by a whole-line opacity fade capped at 0.4 strength, 150ms |

- `src/components/theme/theme-toggle.css:458` — reduced-motion highlight hide + 120ms fill
- `src/components/theme/theme-toggle.css:358` — reduced-motion row/segment block
- `src/components/theme/theme-toggle.css:362` — `--phase-row-exit-ms: 120`
- `src/components/theme/theme-toggle.css:366` — 120ms opacity-only enter
- `src/components/theme/theme-toggle.tsx:677` — settle skipped under reduced motion
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
