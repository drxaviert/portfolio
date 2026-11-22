# Colour — tokens as built (2026-11-18)

All colour lives in `src/app/globals.css`. Three layers, in order:

1. **Primitives** — `--palette-<hue>-<step>` on `:root` (`src/app/globals.css:233-322`). Raw hex, never a
   role.
2. **Semantic roles** — per phase block; every role points at a primitive or a mix of primitives
   (Day block `:root, [data-phase="day"]` at `src/app/globals.css:379-469`, Dawn `:471-548`,
   Dusk `:550-628`, Night `:630-706`).
3. **Tailwind bridge** — `@theme inline` maps each role to `--color-<role>`
   (`src/app/globals.css:708-735`), so utilities such as `bg-surface` and `text-on-surface-variant`
   read the phase value. `@custom-variant dark` is `[data-phase="night"]` only
   (`src/app/globals.css:13`).

`src/lib/theme-script.ts` writes `data-mode` / `data-phase` before paint; `:root` is the no-script
fallback and holds the Day values.

## 1. Primitive palette

| Token | Value | Source |
| --- | --- | --- |
| `--palette-neutral-50` | `#ffffff` | `src/app/globals.css:234` |
| `--palette-neutral-100` | `#f2f2f2` | `:235` |
| `--palette-neutral-150` | `#f2f1f0` | `:236` |
| `--palette-neutral-200` | `#e5e5e5` | `:237` |
| `--palette-neutral-250` | `#d9d9d9` | `:238` |
| `--palette-neutral-300` | `#b2b2b2` | `:239` |
| `--palette-neutral-350` | `#999999` | `:240` |
| `--palette-neutral-400` | `#666666` | `:241` |
| `--palette-neutral-450` | `#4c4c4c` | `:242` |
| `--palette-neutral-500` | `#404040` | `:243` |
| `--palette-neutral-550` | `#333333` | `:244` |
| `--palette-neutral-600` | `#262626` | `:245` |
| `--palette-neutral-650` | `#191919` | `:246` |
| `--palette-neutral-700` | `#0d0d0d` | `:247` |
| `--palette-neutral-750` | `#090909` | `:248` |
| `--palette-neutral-800` | `#000000` | `:249` |
| `--palette-blue-50` | `#f3f8fc` | `:251` |
| `--palette-blue-100` | `#f1f3f6` | `:252` |
| `--palette-blue-150` | `#eef1f6` | `:253` |
| `--palette-blue-200` | `#ecf0f6` | `:254` |
| `--palette-blue-250` | `#e4eff9` | `:255` |
| `--palette-blue-300` | `#e5edf6` | `:256` |
| `--palette-blue-350` | `#cde2f4` | `:257` |
| `--palette-blue-400` | `#b4d8ff` | `:258` |
| `--palette-blue-450` | `#aed0ed` | `:259` |
| `--palette-blue-500` | `#8fb0f0` | `:260` |
| `--palette-blue-550` | `#81b6e2` | `:261` |
| `--palette-blue-600` | `#60a8e2` | `:262` |
| `--palette-blue-650` | `#7f9bea` | `:263` |
| `--palette-blue-700` | `#3093f8` | `:264` |
| `--palette-blue-750` | `#3687d9` | `:265` |
| `--palette-blue-800` | `#0071c1` | `:266` |
| `--palette-violet-50` | `#fdfbff` | `:268` |
| `--palette-violet-100` | `#fbf6fe` | `:269` |
| `--palette-violet-150` | `#eef0ff` | `:270` |
| `--palette-violet-200` | `#f5eafe` | `:271` |
| `--palette-violet-250` | `#efe7ff` | `:272` |
| `--palette-violet-300` | `#edd8fc` | `:273` |
| `--palette-violet-350` | `#c9ccff` | `:274` |
| `--palette-violet-400` | `#e1c0fb` | `:275` |
| `--palette-violet-450` | `#d19ef9` | `:276` |
| `--palette-violet-500` | `#b49ae6` | `:277` |
| `--palette-violet-550` | `#cb83ff` | `:278` |
| `--palette-violet-600` | `#9b8be0` | `:279` |
| `--palette-violet-650` | `#6670e0` | `:280` |
| `--palette-violet-700` | `#6763e4` | `:281` |
| `--palette-violet-750` | `#0d0d12` | `:282` |
| `--palette-violet-800` | `#0b0b0f` | `:283` |
| `--palette-rose-50` | `#f7c1d9` | `:285` |
| `--palette-rose-100` | `#e7a6e0` | `:286` |
| `--palette-rose-150` | `#f2a0c8` | `:287` |
| `--palette-rose-200` | `#ff90b9` | `:288` |
| `--palette-red-50` | `#fd6850` | `:290` |
| `--palette-red-100` | `#e9786f` | `:291` |
| `--palette-red-150` | `#f73131` | `:292` |
| `--palette-red-200` | `#9d4739` | `:293` |
| `--palette-red-250` | `#6b352d` | `:294` |
| `--palette-red-300` | `#4b2a25` | `:295` |
| `--palette-red-350` | `#342220` | `:296` |
| `--palette-red-400` | `#241d1c` | `:297` |
| `--palette-amber-50` | `#fffdf4` | `:299` |
| `--palette-amber-100` | `#fff8f4` | `:300` |
| `--palette-amber-150` | `#fef8f2` | `:301` |
| `--palette-amber-200` | `#fff8d4` | `:302` |
| `--palette-amber-250` | `#fceee1` | `:303` |
| `--palette-amber-300` | `#f2f0ec` | `:304` |
| `--palette-amber-350` | `#f2ede5` | `:305` |
| `--palette-amber-400` | `#ffe3d6` | `:306` |
| `--palette-amber-450` | `#ffe97a` | `:307` |
| `--palette-amber-500` | `#f9e0c8` | `:308` |
| `--palette-amber-550` | `#f5cca6` | `:309` |
| `--palette-amber-600` | `#f3c46b` | `:310` |
| `--palette-amber-650` | `#ffb451` | `:311` |
| `--palette-amber-700` | `#f0b075` | `:312` |
| `--palette-amber-750` | `#d6b49d` | `:313` |
| `--palette-amber-800` | `#e08030` | `:314` |
| `--palette-green-50` | `#a9d98b` | `:316` |
| `--palette-teal-50` | `#afffea` | `:317` |
| `--palette-teal-100` | `#8fc3c9` | `:318` |
| `--palette-black-a8` | `rgb(0 0 0 / 0.08)` | `:320` |
| `--palette-white-a8` | `rgb(255 255 255 / 0.08)` | `:321` |

Steps are ordered by lightness **inside** a family; the same step number is not the same lightness
across families (e.g. `neutral-600` `#262626` vs `blue-600` `#60a8e2`).

## 2. Semantic roles per phase

Resolved values are the primitive the role points at. Every row's source is the line in that phase's
block; the block ranges are Day `379-469`, Dawn `471-548`, Dusk `550-628`, Night `630-706`.

| Role | Day | Dawn | Dusk | Night | Day source |
| --- | --- | --- | --- | --- | --- |
| `--surface` | `neutral-200` `#e5e5e5` | `neutral-200` | `neutral-200` | `neutral-700` `#0d0d0d` | `:383` |
| `--surface-dim` | `neutral-250` `#d9d9d9` | `neutral-250` | `neutral-250` | `neutral-800` `#000000` | `:384` |
| `--surface-bright` | `neutral-50` `#ffffff` | `neutral-50` | `neutral-50` | `neutral-550` `#333333` | `:385` |
| `--surface-container-low` | `neutral-50` `#ffffff` | `neutral-50` | `neutral-50` | `neutral-650` `#191919` | `:386` |
| `--surface-container` | `neutral-100` `#f2f2f2` | `neutral-100` | `neutral-100` | `neutral-600` `#262626` | `:387` |
| `--surface-container-high` | `neutral-200` `#e5e5e5` | `neutral-200` | `neutral-200` | `neutral-550` `#333333` | `:388` |
| `--surface-container-highest` | `neutral-250` `#d9d9d9` | `neutral-250` | `neutral-250` | `neutral-500` `#404040` | `:389` |
| `--on-surface` | `neutral-700` `#0d0d0d` | `neutral-700` | `neutral-700` | `neutral-100` `#f2f2f2` | `:391` |
| `--on-surface-variant` | `neutral-450` `#4c4c4c` | `neutral-450` | `neutral-450` | `neutral-300` `#b2b2b2` | `:392` |
| `--outline` | `neutral-350` `#999999` | `neutral-350` | `neutral-350` | `neutral-400` `#666666` | `:393` |
| `--outline-variant` | `black-a8` `rgb(0 0 0 / .08)` | `black-a8` | `black-a8` | `white-a8` `rgb(255 255 255 / .08)` | `:394` |
| `--primary` | `blue-750` `#3687d9` | `violet-450` `#d19ef9` | `amber-700` `#f0b075` | `red-50` `#fd6850` | `:396` |
| `--on-primary` | `neutral-50` `#ffffff` | `neutral-50` | `neutral-50` | `neutral-700` `#0d0d0d` | `:397` |
| `--secondary` | `blue-700` `#3093f8` | `violet-300` `#edd8fc` | `amber-500` `#f9e0c8` | `red-150` `#f73131` | `:398` |
| `--toggle-track` | `neutral-200` `#e5e5e5` | `neutral-200` | `neutral-200` | `neutral-700` `#0d0d0d` | `:417` |
| `--toggle-selected` | `neutral-50` `#ffffff` | `neutral-50` | `neutral-50` | `neutral-550` `#333333` | `:418` |
| `--frame-line` | `oklch(89% 0.0138 247.97)` | `oklch(89% 0.0138 247.97)` | `oklch(89% 0.0138 247.97)` | `white-a8` | `:450` |
| `--frame-spot-color` | `oklch(64% 0.147 251.74)` | `oklch(64% 0.147 309.23)` | `oklch(64% 0.146 63.06)` | `var(--primary)` | `:454` |
| `--frame-spot-opacity` | `1` | `1` | `1` | `0.85` | `:455` |

`--frame-line` resolves to `var(--palette-white-a8)` in Night (`:692`), not a literal.
`src/app/layout.tsx:43-46` repeats `#e5e5e5` / `#0d0d0d` as the browser `themeColor`.

### Tracker ramp

`tracker/0` is the empty cell; 1 and 2 are `color-mix(in oklab, …)` steps between it and the fixed
stops at 3 and 4. The percentages are literal arguments of the mix.

| Role | Day | Dawn | Dusk | Night |
| --- | --- | --- | --- | --- |
| `--tracker-0` | `blue-50` `#f3f8fc` | `violet-100` `#fbf6fe` | `amber-150` `#fef8f2` | `red-400` `#241d1c` |
| `--tracker-1` | mix `blue-250`, `blue-350 65%` | mix `violet-200`, `violet-300 85%` | mix `amber-250`, `amber-550 45%` | mix `red-350`, `red-300 50%` |
| `--tracker-2` | mix `blue-350`, `blue-450 45%` | mix `violet-300`, `violet-400 35%` | mix `amber-500`, `amber-550 50%` | mix `red-300`, `red-250 35%` |
| `--tracker-3` | `blue-450` `#aed0ed` | `violet-400` `#e1c0fb` | `amber-550` `#f5cca6` | `red-250` `#6b352d` |
| `--tracker-4` | `blue-550` `#81b6e2` | `violet-450` `#d19ef9` | `amber-700` `#f0b075` | `red-200` `#9d4739` |

Sources: Day `:403-415`, Dawn `:491-503`, Dusk `:570-582`, Night `:650-662`. Consumers:
`bg-tracker-0…4` in `src/components/home/tracker-widget.tsx:14-20`.

### Horizon, orb, play

| Role | Day | Dawn | Dusk | Night | Day source |
| --- | --- | --- | --- | --- | --- |
| `--horizon-base` | `blue-100` `#f1f3f6` | `blue-100` | `blue-100` | `neutral-750` `#090909` | `:425` |
| `--horizon-mid` | `blue-200` `#ecf0f6` | `neutral-150` `#f2f1f0` | `blue-150` `#eef1f6` | `violet-800` `#0b0b0f` | `:426` |
| `--horizon-mid-at` | `82%` | `82%` | `80%` | `90%` | `:427` |
| `--horizon-3` | `blue-300` `#e5edf6` | `amber-350` `#f2ede5` | `amber-300` `#f2f0ec` | `violet-750` `#0d0d12` | `:428` |
| `--horizon-1` | `blue-600` `#60a8e2` | `rose-200` `#ff90b9` | `blue-400` `#b4d8ff` | `violet-700` `#6763e4` | `:429` |
| `--horizon-1-alpha` | `0.06` | `0.06` | `0.06` | `0.06` | `:430` |
| `--horizon-2` | `blue-800` `#0071c1` | `violet-550` `#cb83ff` | `amber-650` `#ffb451` | `teal-50` `#afffea` | `:431` |
| `--horizon-2-alpha` | `0.06` | `0.06` | `0.06` | `0.03` | `:432` |
| `--orb-1` | `blue-600` | `rose-200` | `blue-400` | `amber-750` `#d6b49d` | `:443` |
| `--orb-2` | `blue-800` | `violet-550` | `rose-50` `#f7c1d9` | `red-50` | `:444` |
| `--orb-2-at` | `100%` | `100%` | `50%` | `45%` | `:445` |
| `--orb-3` | `blue-800` | `violet-550` | `amber-650` | `red-50` | `:446` |
| `--play-bg-top` | `amber-450` `#ffe97a` | `rose-150` `#f2a0c8` | `violet-600` `#9b8be0` | `blue-650` `#7f9bea` | `:462` |
| `--play-bg-mid` | `green-50` `#a9d98b` | `red-100` `#e9786f` | `violet-500` `#b49ae6` | `violet-650` `#6670e0` | `:463` |
| `--play-base` | `blue-500` `#8fb0f0` | `amber-600` `#f3c46b` | `teal-100` `#8fc3c9` | `rose-100` `#e7a6e0` | `:464` |
| `--play-bg-bottom` | `var(--play-base)` | `var(--play-base)` | `var(--play-base)` | `var(--play-base)` | `:466` |
| `--play-strand` | `amber-50` `#fffdf4` | `amber-100` `#fff8f4` | `violet-50` `#fdfbff` | `violet-150` `#eef0ff` | `:467` |
| `--play-glow` | `amber-200` `#fff8d4` | `amber-400` `#ffe3d6` | `violet-250` `#efe7ff` | `violet-350` `#c9ccff` | `:468` |

`--horizon-ring-glow` is the one role written as a literal `rgb()` per phase (Safari < 18 cannot parse
`color-mix`), mirroring primitives:

| Phase | Value | Source |
| --- | --- | --- |
| Day | `linear-gradient(45deg, rgb(96 168 226 / .75) 0%, rgb(0 113 193 / .75) 100%)` | `src/app/globals.css:436-440` |
| Dawn | `linear-gradient(45deg, rgb(255 144 185 / .9) 0%, rgb(203 131 255 / .9) 100%)` | `:520-524` |
| Dusk | `linear-gradient(45deg, rgb(240 176 117 / .9) 0%, rgb(224 128 48 / .9) 100%)` | `:600-604` |
| Night | `linear-gradient(45deg, rgb(214 180 157 / .55) 0%, rgb(253 104 80 / .55) 45%, rgb(253 104 80 / .55) 100%)` | `:680-685` |

Consumers: horizon background `src/components/horizon/horizon-background.tsx:254`, ring glow
`src/components/home/ring-hover.css:36`, nav orb `src/components/home/home-nav.tsx:33`, play card
`src/components/play/play-card.tsx:36-39`.

### Registered `@property` initial values

`syntax` descriptors cannot take `var()`, so these stay literal and mirror Day (comment at
`src/app/globals.css:23-26`):

| Property | Initial value | Source |
| --- | --- | --- |
| `--horizon-base` | `#f1f3f6` | `src/app/globals.css:31` |
| `--horizon-mid` | `#ecf0f6` | `:36` |
| `--horizon-mid-at` | `82%` | `:41` |
| `--horizon-1` | `#60a8e2` | `:46` |
| `--horizon-1-alpha` | `0.06` | `:51` |
| `--horizon-2` | `#0071c1` | `:56` |
| `--horizon-2-alpha` | `0.06` | `:61` |
| `--horizon-3` | `#e5edf6` | `:66` |
| `--orb-1` | `#60a8e2` | `:76` |
| `--orb-2` | `#0071c1` | `:81` |
| `--orb-3` | `#0071c1` | `:86` |
| `--orb-2-at` | `100%` | `:91` |

`--orb-gradient` composes the three registered stops (`src/app/globals.css:162-167`).

## 3. Colour literals outside the tokens

| Where | Value | Source | Consumers |
| --- | --- | --- | --- |
| Drawer backdrop | `rgb(8 8 8 / 0.4)`; Night `rgb(0 0 0 / 0.62)` | `src/components/work/expand-shell.css:34`, `:40` | `.wd-expand-backdrop` |
| Text selection | `color-mix(in oklab, var(--primary) 30%, transparent)` | `src/app/globals.css:796-799` | `::selection` |
| Reader blur tint | `color-mix(in oklch, var(--surface-container-low) 60%, transparent)` | `src/components/work/blur-stack.css:16-20` | `.wd-blur-stack` gradient |
| Entrance veil | `color-mix(in oklab, var(--surface-bright) calc(var(--soft-veil) * 100%), transparent)` | `src/components/home/home-entrance.css:46-50` | `.entrance-soft` |
| Dawn prototype scrim | `color-mix(in oklab, var(--on-surface) 8%, var(--surface-dim))` | `src/components/home/home-entrance.css:131` | `--dawn-scrim` (dev variants only) |
| Card fade | `color-mix(in oklab, var(--surface-dim) …%, transparent)` at 96% / 86.4% / 48% | `src/components/home/home-cards.css:13-39` | featured card title scrim |
| Frame spotlight pool | `var(--frame-spot-color, var(--primary))`; fallback opacity `0.85` | `src/components/home/frame-line-spotlight.css:44`, `:94` | `.frame-spot-pool`, `.frame-spot-glow` |
| Nav hover capsule | `color-mix(in oklab, var(--on-surface) 5%, var(--surface-container))`, revealed at `0.55`; reduced motion fills the item with the same mix at `55%` alpha | `src/components/home/nav-items.css:33-49`, `:170-178` | `.nav-glide`, reduced-motion hover fill |
| Play card gradient | `linear-gradient(180deg, … 0%, … 58%, … 74%, … 100%)` | `src/components/play/play-card.tsx:36-39` | `/play` card |

## 4. Where `tokens.md` differs from the code

`tokens.md` was sampled from Figma on 2026-11-14. The colour roles it lists resolve to the same
primitives as the code, with these differences:

| Item | `tokens.md` | Code today | Source |
| --- | --- | --- | --- |
| Theme toggle width | 104×32 | track width is `segments * 34 + 4` → **106px** for 3 segments (32px tall) | `src/components/theme/theme-toggle.tsx:278-283`, `:699` |
| Theme menu row height | 40px | `h-11` = **44px** | `src/components/theme/theme-toggle.tsx:1589` |
| Theme menu height | 132px | 168px wide; three 44px rows + 2×2px gaps + 2×4px padding = **144px** (max-height is `calc(100dvh - 4rem)`) | `src/components/theme/theme-toggle.tsx:1569` |
| Theme menu name | "Theme menu" | the row in code is the `phase-row` (Clock · Dawn · Midday · Dusk); the menu is the under-768 `role="menu"` popover | `src/components/theme/theme-toggle.tsx:1527`, `:1569` |

`tokens.md` cites no source lines (it is a Figma record), so the comparison above is by value and by
component description. Role values, elevation, radius, type, and the horizon/orb/play stops all match
the source at the time of writing.

## Notes

- `--tracker-1` and `--tracker-2` have no hex value of their own; their rendered colour depends on the
  `color-mix` percentages above.
- `--frame-spot-opacity` is the only role whose value is a number rather than a colour.
- The phase blocks repeat the light shell (`surface`, `on-surface`, `outline`, `toggle`) rather than
  inheriting it; each block is written out in full.
