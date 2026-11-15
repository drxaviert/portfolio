# Design system motion — 2026-11-13

The shipped motion of the theme toggle, the Day phase row, the home nav's Glide capsule and the Work drawer, recorded from the code (toggle and nav from PR #12, `5bbfba9` / `d574d89`; drawer at `98b6429`). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, `ease-in` for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` for the icon settle.
- The drawer flies on `cubic-bezier(0.32, 0.72, 0, 1)` (panel and nav together), its content cascades on `cubic-bezier(0.22, 1, 0.36, 1)`, and the blur resolving on top of that fade runs slower, on `cubic-bezier(0.25, 0.1, 0.25, 1)`.
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

## Selection feedback

Selection is painted by the stretch highlight (next section); the segment itself no longer carries a fill in the default path, so a fast flip can never paint two selected segments. The incoming label still fades over 150ms and is released on the same frame. The phase-switch fade in `globals.css` sets a transition on every element for one theme change; the segment and tooltip rules are specific enough to keep their own timings through it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection enters, reduced motion | fill `background-color` | 120ms | 0 | `ease-out` | transparent → `--toggle-selected` |
| Segment focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |
| Segment blurred | tooltip `opacity` | 0 | 0 | — | 1 → 0 |
| Pointer enters a segment | tooltip `opacity` | 150ms | 300ms | `ease-out` | 0 → 1 |
| Pointer enters a label in a warm group | tooltip `opacity` | 0 | 0 | — | 0 → 1, no fade |
| Pointer leaves a segment | tooltip `opacity` | 0 | 0 | — | 1 → 0 |

The fill row is the reduced-motion path only; the default highlight hides its layer and crossfades that fill in 120ms. The label fade is declared on `:focus-visible`/`:hover`, so losing the state removes the transition instead of starting the reverse one. The phase-row entrance stagger delays only `opacity`/`translate`; colour and scale are never delayed.

- `src/components/theme/theme-toggle.css:458` — reduced-motion fill crossfade (120ms)
- `src/components/theme/theme-toggle.css:306` — tooltip hidden by default
- `src/components/theme/theme-toggle.css:310` — focused label fade-in
- `src/components/theme/theme-toggle.css:316` — hovered label, 300ms
- `src/components/theme/theme-toggle.css:323` — released label, no transition

Once a label in the nav has opened, the group is warm: the next label opens on the frame the pointer reaches it, with no delay and no fade, and the group goes cold 300ms after the pointer leaves the nav. The first label still pays the 300ms, which is what keeps incidental travel from flashing labels across the bar.

- `src/components/nav/use-tooltip-warm.ts:6` — `TOOLTIP_WARM_MS = 300`
- `src/components/nav/use-tooltip-warm.ts:18` — the group's warm state
- `src/components/theme/theme-toggle.css:331` — warm segment labels drop the transition
- `src/components/home/nav-items.css:80` — warm glyph label drops the transition

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

The home nav's three labels and the design-system glyph share one capsule instead of each carrying its own hover fill. The glyph is the fourth target of the same run — the capsule crosses the divider to it and back — and the run sits to the right of the orb head, which the capsule never reaches. The motion is the selection highlight's stretch & snap, imported rather than re-declared: the nav reads `LEADING_DURATION_MS`, `TRAILING_DELAY_MS`, `TRAILING_DURATION_MS`, `leadingEase` and `trailingEase` from `theme-toggle.tsx`, so the nav and the toggle cannot drift.

The glyph carries `data-glide-break`, which cuts the run: a move across that boundary never glides — the capsule fades out where it is, then snaps onto the new item on the first-entry path, so it never stretches across the divider (every other pair still glides).

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Hover moves between items | capsule `clip-path` | 180ms / 220ms | 0 / 120ms | ease-out cubic / quint | current edges → target edges |
| Hover moves mid-flight | capsule `clip-path` | same as above | same | same | retargeted from the current edges, never from zero |
| First item entered | capsule layer `opacity` | 150ms | 0 | `ease-out` | 0 → 0.55, placed on the item with no travel |
| Pointer leaves the run | capsule layer `opacity` | 150ms | 0 | `ease-out` | 0.55 → 0 |
| Item hovered | item `color` | 150ms | 0 | `ease-out` | `on-surface-variant` → `on-surface` |
| Item pressed | `scale` | 150ms | 0 | `ease-out` | 1 → 0.96 |
| Glyph hovered | tooltip `opacity` | 150ms | 300ms | `ease-out` | 0 → 1 |
| Glyph focused | tooltip `opacity` | 150ms | 0 | `ease-out` | 0 → 1 |
| Hover enters, reduced motion | item fill `background-color` | 120ms | 0 | `ease-out` | transparent → 55% `surface-container` |

A frame writes one property: the capsule keeps the run's width and carries the pill as a `clip-path` inset, so the leading and trailing edges move independently while no width or other layout property changes. At rest the pill is the hovered item's box at the `--radius-md` token. Hover is gated to `(hover: hover) and (pointer: fine)`, focus is a 2px `primary` ring on the item, and Work keeps `aria-current="page"`. Reduced motion hides the capsule: the hovered item carries the 55% `surface-container` fill and crossfades it in 120ms with no travel, so the state change survives without the movement.

- `src/components/home/nav-items.tsx:5` — durations and curves imported from the toggle
- `src/components/home/nav-items.tsx:82` — the one capsule runner shared by every item
- `src/components/home/nav-items.tsx:140` — per-frame `clip-path` inset (paint only)
- `src/components/home/nav-items.tsx:180` — first entry and reduced motion snap with no travel
- `src/components/home/nav-items.tsx:199` — group break: fade out, then snap, never stretch
- `src/components/home/nav-items.tsx:296` — the item run: labels, divider, glyph as the fourth target
- `src/components/home/nav-items.css:19` — press `scale: 0.96`, 150ms `ease-out`
- `src/components/home/nav-items.css:57` — hover weight 0.55
- `src/components/home/nav-items.css:75` — glyph tooltip, 300ms delay
- `src/components/home/nav-items.css:104` — reduced-motion capsule hide
- `src/components/home/nav-items.css:111` — reduced-motion 55% fill crossfade

## Day phase row entrance — "Stagger + icons"

The row is a 4-segment track (Clock · Dawn · Midday · Dusk) above the toggle on the homepage and below it in the drawer. It scales out of the toggle's nearest corner (bottom right when it sits above, top right when it hangs below), then the segments fade and rise left to right, then each icon settles 60ms after its own segment.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Row opens | `opacity` | 400ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 → 1 |
| Row opens | `transform` | 400ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | `scale(0.96)` → `none`, origin bottom right (top right in the drawer) |
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
- `src/components/nav/nav-dock.css:111` — the drawer's row hangs below, so it grows from its top corner
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

## Work drawer — panel and backdrop

The intercepted reader is one fixed panel over the live homepage. On open it FLIPs out of the featured card, on close back into the card's live rect. Only `transform` and `opacity` animate; the panel keeps its final layout box the whole time, and the card → panel pose is measured once, before the first paint. A close that interrupts the open retargets from the current pose instead of restarting.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card opened | panel `transform` | 480ms | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` | card rect → panel box (`translate` + `scale`, origin top left) |
| Study → study (no card) | panel | 0 | 0 | — | settles in place, no move |
| Reverse morph | panel `transform` | 300ms | 0 | `ease-in` | current pose → the card's live rect |
| Reverse morph, or no card | panel `opacity` | 120ms | 0 | `ease-out` | 1 → 0 |
| Opened, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1, `transform: none` |
| Close interrupts the open | panel `transform` | 300ms | 0 | `ease-in` | retargeted from the live pose, never from zero |
| Resize mid-open | panel | — | — | — | completes the flight |
| Backdrop in | `opacity` | 320ms | 0 | `ease-out` | 0 → 1 (0.4 black; 0.62 in Night) |
| Backdrop out | `opacity` | 240ms | 0 | `ease-in` | 1 → 0 |
| Content out on close | scroll column `opacity` | 140ms | 0 | `ease-in` | 1 → 0 |
| Backdrop / content, reduced motion | `opacity` | 120ms | 0 | `ease-out` | 0 → 1 / 1 → 0 |

- `src/components/work/morph.ts:20` — `MORPH_EASE` `cubic-bezier(0.32, 0.72, 0, 1)`
- `src/components/work/morph.ts:21` — `MORPH_OPEN_S = 0.48`
- `src/components/work/morph.ts:22` — `MORPH_CLOSE_S = 0.3`
- `src/components/work/use-morph.ts:159` — the open flight, transform only
- `src/components/work/use-morph.ts:218` — the reverse pose into the card's live rect
- `src/components/work/use-morph.ts:31` — 120ms opacity path (`FADE_S`)
- `src/components/work/expand-shell.css:18` — backdrop in 320ms `ease-out`
- `src/components/work/expand-shell.css:19` — backdrop out 240ms `ease-in`
- `src/components/work/expand-shell.css:20` — content out 140ms `ease-in`
- `src/components/work/expand-shell.css:21` — reduced-motion 120ms `ease-out`

## Work drawer — nav dock

The one nav lives in the root layout and never remounts, so opening a study FLIPs it from the home slot to the panel's top row on the panel's own curve. Home is CSS geometry (1200px frame, 1136px bar, `max(pad + offset, 50dvh + offset/2 - 2rem)` with offsets 716px at 1280, 604 at 1024, 804 at 768 and 824 below), corrected at runtime against `[data-nav-slot]` when it drifts by more than 0.5px. The reader position is `--wd-panel-inset + --wd-nav-inset`: 44px from the viewport top at 768 and up, 16px below.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Study opened | dock `transform` | 480ms | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` | home top → reader top (`translateY` of the measured delta) |
| Study closed | dock `transform` | 300ms | 0 | `ease-in` | reader top → home top |
| Reduced motion, or no card | dock `opacity` | 60ms out + 60ms in | 0 | `ease-out` | 1 → 0 → 1, no transform |
| Study → study | dock | 0 | 0 | — | stays at the reader position |
| Resize mid-flight | dock | — | — | — | lands the move |
| Home rest, drifted | dock `top` | 0 | — | — | slot top when the CSS is off by > 0.5px |

- `src/components/nav/nav-dock.tsx:111` — open 480 / close 300 on the panel's constants
- `src/components/nav/nav-dock.tsx:29` — 60ms half of the reduced-motion crossfade
- `src/components/nav/nav-dock.tsx:109` — the `translateY` flight, measured from the live rect
- `src/components/nav/nav-dock.tsx:119` — resize lands the flight
- `src/components/nav/nav-dock.tsx:163` — 0.5px slot-drift correction
- `src/components/nav/nav-dock.css:15` — home geometry
- `src/components/nav/nav-dock.css:59` — reader top `panel inset + nav inset`

## Work drawer — content cascade

The cascade is a handoff from the panel, not a second entrance: it is released at the reveal, 360ms into the 480ms open (120ms before the panel lands). Cover first, then the header, then the body, on one even 80ms beat.

| Block | Starts at | Opacity + 10px rise | Defocus |
| --- | --- | --- | --- |
| Cover | 0ms | 800ms `cubic-bezier(0.22, 1, 0.36, 1)` | none |
| Title | 80ms | same | 800ms `cubic-bezier(0.25, 0.1, 0.25, 1)`, `blur(10px)` → none |
| Subtitle | 160ms | same | same |
| Meta | 240ms | same | same |
| p1 | 320ms | same | same |
| p2 | 400ms | same | same |
| p3 and below | 480ms | same | same |

Every block holds its start state (`backwards` fill), so nothing paints at its end state before its beat. The blur has its own longer curve: the fade is at 92% by 400ms while the defocus still measures 3.2px there, so the text resolves instead of snapping sharp. The cover carries no filter (blur on the large media was the one measured cost). The window ends 1280ms after the reveal, 1640ms after the click.

- `src/components/work/entrance.css:37` — fade curve `cubic-bezier(0.22, 1, 0.36, 1)`
- `src/components/work/entrance.css:40` — defocus curve `cubic-bezier(0.25, 0.1, 0.25, 1)`
- `src/components/work/entrance.css:41` — 800ms for both
- `src/components/work/entrance.css:74` — `blur(10px)` start
- `src/components/work/entrance.css:88` — two animations, fade then defocus
- `src/components/work/entrance.css:93` — both ride the block's beat and the hand-off lead
- `src/components/work/entrance.css:110` — 80ms beat, title
- `src/components/work/entrance.css:130` — 480ms, p3 and below
- `src/components/work/use-morph.ts:177` — reveal at open − 120ms
- `src/components/work/parts.tsx:415` — `--wd-beat-lead` on the incoming panel

## Work drawer — study hand-off

"Next project" is not a route swap with an empty beat: the outgoing article leaves on the reader's own 140ms close fade, the route is pushed 49ms into it, and the incoming entrance mounts 120ms in.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Next project | outgoing scroll column `opacity` | 140ms | 0 | `ease-in` | 1 → 0, held to the last frame |
| Next project | route commit | — | 49ms (35% of 140) | — | push / replace lands inside the fade |
| Incoming study | cascade | — | −120ms lead | — | the entrance's first paint is already ~55% in |
| Reduced motion | — | 0 | 0 | — | one commit, no fade, no lead |

The lead is a module-level timestamp read once by the incoming mount and cleared: it expires after 900ms so a slow route can never leak it into a normal card open.

- `src/components/work/progression.ts:19` — `PROGRESSION_EXIT_MS = 140`
- `src/components/work/progression.ts:21` — `PROGRESSION_LEAD_MS = 120`
- `src/components/work/progression.ts:27` — `PUSH_RATIO = 0.35`
- `src/components/work/progression.ts:29` — `LEAD_TTL_MS = 900`
- `src/components/work/progression.ts:72` — the 140ms `ease-in` fade, `fill: forwards`
- `src/components/work/parts.tsx:415` — the incoming panel's `--wd-beat-lead`

## Work drawer — geometry and popover sides

One set of root tokens positions the drawer, so the nav, the blur zone, the reading column and the rail cannot drift apart. The drawer's nav sits 44px from the viewport top at 768 and up (16px below) and the study starts 32px under it (24px below 768).

| Token | Below 768 | 768 and up | Read by |
| --- | --- | --- | --- |
| `--wd-panel-inset` | 0px | 16px | panel inset, nav top |
| `--wd-nav-inset` | 16px | 28px | nav top, blur height, column clearance, rail |
| `--wd-nav-height` | 4rem | 4rem | nav box, blur height, column clearance |
| `--wd-nav-content-gap` | 24px | 32px | column top padding, rail sticky top |
| `--wd-phase-row-gap` | 4px | 4px | the picker row's side offset |

The Day phase row opens above the toggle on the homepage and below it in the drawer, always at `--wd-phase-row-gap`. Each track's labels point away from the other track: home has the row above, so the toggle's labels go below and the row's go above; the reader has the row below, so the toggle's labels go above and the row's go below. The glyph's label keeps the reader's downward side.

- `src/app/globals.css:258` — the token block
- `src/app/globals.css:267` — the 768 overrides
- `src/components/work/reader.css:48` — column top padding
- `src/components/work/reader.css:104` — rail sticky top
- `src/components/nav/nav-dock.css:72` — home label side
- `src/components/nav/nav-dock.css:77` — reader label side
- `src/components/nav/nav-dock.css:103` — the reader's picker row, 4px below the toggle

## Work drawer — blur stack and reduced motion

The progressive blur over the reader's top edge is six static `backdrop-filter` bands (1, 2, 4, 8, 16, 32px) sharing the nav's box; nothing in it animates, only the content moves under it. `prefers-reduced-transparency` or no `backdrop-filter` support replaces the bands with one solid gradient from the panel surface.

| Path | Behaviour |
| --- | --- |
| Open | panel opacity 120ms `ease-out`, no transform; nav crossfades over 2 × 60ms; backdrop 120ms |
| Cascade | `animation: none` on the cover and every text block; the scroll column is one 120ms opacity pass |
| Hand-off | no fade and no wait; the incoming column skips its own fade (`data-progression="lead"`) |
| Content out | 140ms `ease-in` on close, 120ms `ease-out` reduced |
| Thumb pair, rail | 120ms `ease-out`, visibility steps with the fade |
| Picker row | existing rows: opacity only 120ms, no scale, no icon settle |

- `src/components/work/blur-stack.tsx:4` — six bands
- `src/components/work/blur-stack.css:96` — reduced-transparency / no-support fallback
- `src/components/work/entrance.css:136` — reduced-motion `animation: none`
- `src/components/work/entrance.css:157` — the hand-off column keeps `opacity: 1`
- `src/components/work/reader.css:253` — thumb-pair reduced path

## Reduced motion

One opacity fade for the whole row. No scale, no segment rise, no icon settle, no press scale.

| Element | Behaviour |
| --- | --- |
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
