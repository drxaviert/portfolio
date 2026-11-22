# Spacing and layout — as built (2026-11-18)

Geometry is CSS first: nothing on the home page or in the reader is positioned by measurement except
the two cases named in "Derived in JS". Values below are the ones in the source, including ones that
do not sit on a single scale.

## Base unit

`--spacing: 0.25rem` (`src/app/globals.css:755`) is Tailwind's 4px step. The utilities actually used:

| Utility | px | Where |
| --- | --- | --- |
| `gap-1.5` | 6 | tracker pager dots (`src/components/home/tracker-widget.tsx:89`) |
| `p-0.5` | 2 | theme toggle track (`src/components/theme/theme-toggle.tsx:699`) |
| `gap-0.5` | 2 | theme menu rows (`src/components/theme/theme-toggle.tsx:1569`) |
| `p-1` | 4 | theme menu padding (`:1569`) |
| `gap-2` | 8 | theme menu icon → label (`:1589`) |
| `gap-3` | 12 | home column, nav item group, tracker bands horizontally (`src/components/home/home-layout.tsx:129`, `src/components/home/home-nav.tsx:65`) |
| `p-3` / `px-3` | 12 | theme menu row inline padding (`src/components/theme/theme-toggle.tsx:1589`) |
| `p-4` / `px-4` / `inset-4` | 16 | nav bar, home frame, dev panels (`src/components/home/home-nav.tsx:50`) |
| `p-5` | 20 | featured card at 375 (`src/components/home/home-cards.tsx:65`) |
| `mx-6` | 24 | nav divider (`src/components/home/nav-items.tsx:539`) |
| `p-8` / `inset-8` | 32 | featured card at `md`+, card-fade box (`src/components/home/home-cards.tsx:65`, `:90`) |
| `h-11` | 44 | theme menu row (`src/components/theme/theme-toggle.tsx:1589`) |

## Home page frame

| Item | Value | Source |
| --- | --- | --- |
| Outer frame max width | `1200px` | `src/components/home/home-layout.tsx:113` |
| Frame padding | `16px`; `md` `32px`/`48px`; `xl` top/bottom `60px` | `home-layout.tsx:113` (`px-4 py-4 md:px-8 md:py-12 xl:py-15`) |
| Frame gap (vertical breathing above/below the content column) | `clamp(0px, calc((100dvh - 780px) / 2), 64px)` | `home-layout.tsx:23-25` |
| Content column | `max-width: 1136px`, `gap: 12px` | `home-layout.tsx:129` |
| Vertical frame lines | `1px`, on the content column's edges, from `1440px` | `home-layout.tsx:118-127` |
| Horizontal frame lines | `1px`, `-inset-x-8` (32px each side), at `calc(var(--frame-gap) * -1 - 1px)` top and `calc(var(--frame-gap) * -1)` bottom | `home-layout.tsx:133-144` |
| Nav slot | `h-16` (64px) | `home-layout.tsx:216` |

The comment at `home-layout.tsx:17-22` records the nominal frame as 780px content + 2 × 64px gaps =
908px; a 900px-tall viewport overflows by 8px, which is why the gap shrinks.

## Nav dock

| Item | Value | Source |
| --- | --- | --- |
| `--wd-frame-pad` | `16px`; `md` `32px`; `xl` `60px` | `src/components/nav/nav-dock.css:16`, `:39`, `:52` |
| `--wd-nav-offset` | `824px`; `md` `804px`; `lg` `604px`; `xl` `716px` | `nav-dock.css:17`, `:40`, `:46`, `:53` |
| Top | `max(calc(var(--wd-frame-pad) + var(--wd-nav-offset)), calc(50dvh + var(--wd-nav-offset) / 2 - 2rem))` | `nav-dock.css:20-23` |
| Left | `max(var(--wd-frame-pad), calc(50% - 568px))` | `nav-dock.css:24` |
| Width | `min(1136px, 100% - var(--wd-frame-pad) * 2)` | `nav-dock.css:25` |
| z-index | `60` | `nav-dock.css:28` |
| Reader position | `position: fixed; top: calc(var(--wd-panel-inset) + var(--wd-nav-inset))` | `nav-dock.css:59-62` |
| Nav box | `h-16`, `px-4`, `rounded-lg` | `src/components/home/home-nav.tsx:50` |

The comment at `nav-dock.css:9-12` spells out the offset as tracker + 12px gap + card band + 12px gap.
Those terms give 804 at `md` (220 + 12 + 560 + 12), 604 at `lg` (220 + 12 + 360 + 12) and 716 at `xl`
(276 + 12 + 416 + 12). Below `md` the literal is **824px** while the same sum is 604px
(160 + 12 + 420 + 12); the dock corrects a mismatch against `[data-nav-slot]` at runtime when it is
over `0.5px` (`src/components/nav/nav-dock.tsx:205-220`).

## Viewport edge blur

Fixed progressive blur at the top and bottom of the viewport on the homepage only
(`src/components/edge-blur/viewport-edge-blur.tsx`, mounted by `<ViewportEdgeBlur />` in
`src/app/page.tsx`, not in the root layout; `/work*` composes the home screen from its own layout and
gets no bands): content scrolling under an edge blurs more the closer it gets to it. PR #81 scoped it
to the homepage and raised the band from `64px` to `172px`.

| Item | Value | Source |
| --- | --- | --- |
| Band height | `172px` (`--edge-blur-height`; `viewport-edge-blur.css` falls back to `172px`) | `src/app/globals.css:217` (`:root`, beside the reader geometry) |
| Bottom band | `172px + env(safe-area-inset-bottom)` | `viewport-edge-blur.css:31` |
| Peak band blur | `8px` (`--edge-blur-max`); ramp `0.5/1/2/4/6/8px` | `viewport-edge-blur.css` |
| Bands per edge | six, the reader's stops (percentages of the band) | `src/components/work/blur-stack.css` |
| z-index | `40` | `viewport-edge-blur.css` |

## Layer order (fixed overlays)

| Layer | z-index | Source |
| --- | --- | --- |
| Entrance veil | `10` | `src/components/home/home-entrance.css:44` |
| Viewport edge blur (homepage only) | `40` | `src/components/edge-blur/viewport-edge-blur.css` |
| Reader (drawer) layer | `50` | `src/components/work/drawer-shell.css:30` |
| Nav dock | `60` | `nav-dock.css:28` |

On the homepage the edge blur sits between the content and the reader, so the nav stays sharp where it passes over
the top band, and an open study's panel covers both bands rather than stacking under them.

## Home bands and cards

| Element | 375 | `md` (768) | `lg` (1024) | `xl` (1280) | Source |
| --- | --- | --- | --- | --- | --- |
| Tracker card | `160×160`, `padding-block: 22px` | `220×220`, `26px` top | `220×220` | `276h × 275w` | `src/components/home/tracker-widget.tsx:77` |
| Tracker grid | `98px` wide (7×7) | `165px` (two 7×16 bands) | same | `223px` | `tracker-widget.tsx:80-87` |
| Tracker cell gap | `3px` | `3px` | `3px` | `3px` | `tracker-widget.tsx:53`, `:64` |
| Gap between tracker bands | — | `9px` | `9px` | `9px` | `tracker-widget.tsx:84` |
| Tracker pager dot | `6px` (`size-1.5`), `6px` gap | same | same | same | `tracker-widget.tsx:89-93` |
| Featured card band | `420px` | `560px` | `360px` | `416px` | `src/components/home/home-layout.tsx:169`, `:193` |
| Empty-work band | `420px` | `560px` | `360px` | `416px` | `home-layout.tsx:169` |
| Featured card padding | `20px` (`p-5`) | `32px` (`md:p-8`) | same | same | `src/components/home/home-cards.tsx:65` |
| Card-fade inset | `32px` (`inset-8`) | same | same | same | `home-cards.tsx:90` |
| Play card (home) | `849×276` at 1440 | same | same | same | the home `PlayCard` is `flex-1` (`src/components/home/home-cards.tsx:193`; cell `min-w-0 flex-1` at `src/components/home/home-layout.tsx:156-162`), so its width is `1136 − 275 − 12 = 849` at 1440 and the height `276` follows the tracker card (`src/components/home/tracker-widget.tsx:77`); `/play` has its own fixed 849×276 at `src/components/play/play-card.tsx:30` |
| Nav orb | `36px` (`size-9`) | same | same | same | `src/components/home/home-nav.tsx:32` |
| Orb eyes | `8×3.4px` at `top: 10.5px`, `left: 13.5px` / `20.6px` | same | same | same | `home-nav.tsx:35-36` |
| Nav item | `h-8` (32px), `px-2` | same | same | same | `src/components/home/nav-items.tsx:25` |
| Nav divider | `mx-6` (24px), `h-5` (20px), `w-px` | visible | visible | visible | `nav-items.tsx:539` |
| Nav glyph | `size-8` (32px) | visible | visible | visible | `nav-items.tsx:37` |

The tracker card's `w-[275px]` at `xl` against `xl:h-[276px]` is literal in the source
(`tracker-widget.tsx:77`).

## Carousel

| Item | 375–767 | `md` (768) | `lg` (1024) | `xl` (1280) | Source |
| --- | --- | --- | --- | --- | --- |
| Layout | stacked card + slivers | carousel | carousel | carousel | `src/components/home/home-layout.tsx:174-192` |
| Row height | — | `560px` | `360px` | `416px` | `src/components/home/carousel/home-carousel.css:26`, `:40`, `:51` |
| Slot 0 | — | `444fr` | `656fr` | `753fr` | `home-carousel.css:13`, `:35`, `:46` |
| Slot 1 | — | `120fr` | `140fr` | `180fr` | `home-carousel.css:14`, `:36`, `:47` |
| Slot 2 | — | `52fr` | `64fr` | `83fr` | `:14`, `:36`, `:47` |
| Slot 3 | — | `52fr` | `64fr` | `84fr` | `:15`, `:37`, `:48` |
| Gap | — | `12px` | `12px` | `12px` | `home-carousel.css:61`; `GAP = 12` at `src/components/home/carousel/carousel-math.ts:12` |
| Card shadow pad | `8px` | `8px` | `8px` | `8px` | `home-carousel.css:23` |
| Title inset | `32px` left/right/bottom | same | same | same | `home-carousel.css:203-213` |

- Unit: `--u: calc((100% - 36px) / (var(--c0) + var(--c1) + var(--c2) + var(--c3)))`
  (`home-carousel.css:18`). The `36px` is three 12px gaps.
- Pre-measure placement: slot *n* left is `--c-off + --u * (sum of earlier columns) + 12px * n`, width
  `--u * --cn` (`home-carousel.css:217-237`).
- Short runs centre their own columns: `--c-off` is `(100% − u·Σc) / 2` for 1 slot, with `+12px` /
  `+24px` for 2 and 3 slots (`home-carousel.css:72-88`).
- Row clip: rest `inset(-12px -6px)`; stepping `inset(-12px -4px)`; peeking `inset(-12px 0 -12px -6px)`
  (`home-carousel.css:30`, `:699-701`, `:713-715`).
- Edge mask (`edgeWidth`): `28px` fade starting `12px` in; mask image is 24px larger on every side and
  positioned `-12px -12px` (`home-carousel.css:309-323`; default `src/components/home/carousel/edge-blur.ts:15-18`).
- Edge blur: `2.5px` (`edge-blur.ts:17`).
- Hover peek defaults: reach `32px` inside the column, `24px` outside, reveal `450ms`, retract `350ms`,
  leave delay `120ms`, fade strength `0.5`, progressive-blur ramp `100%`, max blur `8px`, fade width
  `40%` of the card (`src/components/home/carousel/hover-peek.ts:33-43`).
- Peek fade is derived: `Math.max(8, Math.round(cardWidth * 40 / 100))` — `34px` for the 84px last slot
  and `33px` for the 83px slot 2 at `xl` (`src/components/home/carousel/home-carousel.tsx:1788-1799`).
- Peek shift: last slot width + 12px gap → `96px` at `xl` (`hover-peek.ts:110-120`).
- Slim-card content fade: `28px`, `clamp(0px, var(--car-wide) − 100cqw, 28px)`
  (`home-carousel.css:901-918`).
- Title fade in at `75%` eased progress over `20%` (`src/components/home/carousel/carousel-settings.ts:23-24`).

## Reader (drawer)

| Item | Below 768 | 768+ | Source |
| --- | --- | --- | --- |
| `--wd-panel-inset` | `0px` | `16px` | `src/app/globals.css:208`, `:217` |
| `--wd-nav-inset` | `16px` | `28px` | `:209`, `:218` |
| `--wd-nav-height` | `4rem` | `4rem` | `:210` |
| `--wd-nav-content-gap` | `24px` | `32px` | `:211`, `:219` |
| `--wd-phase-row-gap` | `4px` | `4px` | `:212` |
| Panel radius / elevation | none | `12px`, `--shadow-card` + ambient shadow | `src/components/work/reader.css:23-29` |
| Column max width | `582px` (550 measure + 2 × 16 gutters) | same | `reader.css:63` |
| Column padding | top `calc(--wd-nav-inset + --wd-nav-height + --wd-nav-content-gap)`, inline `16px`, bottom `64px` | same | `reader.css:66-69` |
| Column bottom, no rail | `88px` (below 1024) | `64px` | `reader.css:246-249` |
| Rail | hidden | shown ≥1024: `width: 170px`, `right: calc(100% + 4px)` | `reader.css:93-107` |
| Margin note / caption | inline | `left: calc(100% + 20px)`, `width: 170px`, top `2px` note / `4px` caption | `reader.css:630-638`, `:685-699` |
| Wide figure | inline | `min(880px, 100cqi - 96px)` | `reader.css:641-647` |
| Contact grid | 3 columns under 560, `8px` gap, `4/3` cells | 4 columns | `reader.css:963-977` |
| Step media | `16 / 9` | same | `reader.css:873` |
| Step bar inset | `12px`, `12px` gap | same | `reader.css:876-886` |
| Step tab | `30×30`, radius `6px`, `4px` gap | same | `reader.css:888-907` |
| Replay chip | `5px 9px` padding, radius `6px`, 44px target | same | `reader.css:919-942` |
| Thumb targets | `44×44`, `999px` radius, `16px` minimum inset | hidden ≥1024 | `reader.css:211-244` |
| Hero | `aspect-ratio: 689 / 352`, radius `12px` | same | `reader.css:420-424` |
| Blur stack | height `calc(var(--wd-nav-inset) + var(--wd-nav-height))`, six bands 1/2/4/8/16/32px | same | `src/components/work/blur-stack.tsx:20`; `src/components/work/reader.tsx:43`; `src/components/work/blur-stack.css:57-92` |
| Blur band stops | `83.33/100`, `66.67/83.33`, `50/66.67`, `33.33/50`, `16.67/33.33`, `0/16.67` | same | `blur-stack.css:57-92` |

Hero scale relationship: `689 = 753 − 2 × 32`; the faux-UI canvas is shifted by
`calc(var(--fu-scale) * -32px * 753 / 689)` and scaled by `calc(var(--fu-scale) * 753 / 689)`
(`reader.css:427-432`).

### Ruler

| Item | Value | Source |
| --- | --- | --- |
| Gap from column | `40px`, grows to `max(40px, (room − width) / 2)` | `src/components/work/scroll-ruler.tsx:85`, `:354` |
| Clearance from panel edge | `16px`; ruler hides when `room < 40 + width + 16` | `scroll-ruler.tsx:87`, `:356` |
| Width | `18px` (JS fallback `18`) | `src/components/work/scroll-ruler.css:18`; `scroll-ruler.tsx:91` |
| Tick row | `13px` | `scroll-ruler.css:16` |
| Vertical padding | `10px` | `scroll-ruler.css:17` |
| Right offset | `var(--wd-ruler-right, 22px)`, written back in px | `scroll-ruler.css:22`; `scroll-ruler.tsx:357` |
| Tick | `13×1px`, `scaleX(0.46)` → 6px at rest, radius `1px` | `scroll-ruler.css:64-75` |
| Section tick | `15×1px`, `scaleX(0.73)` → 11px at rest, radius `3px` row | `scroll-ruler.css:84-104` |
| Indicator | `2px` tall, radius `1px` | `scroll-ruler.css:126-135` |
| Hover card | `280px` wide, `12px` from the ruler, padding `10px 12px 11px` | `scroll-ruler.css:146-160` |
| Jump hold | `1200ms` | `scroll-ruler.tsx:89` |

## Controls

| Element | Value | Source |
| --- | --- | --- |
| Theme toggle track | `segments × 34px + 4px` → `106px` (3 segments), `140px` (4) | `src/components/theme/theme-toggle.tsx:278-283` |
| Track height | `32px`, padding `2px` | `theme-toggle.tsx:699` (`h-8 p-0.5`) |
| Segment | `28px` high (`h-7`), `flex-1`, radius `6px` | `theme-toggle.tsx:571` |
| Selection pill | `28px` high, radius `6px`, `2px` inside the track | `theme-toggle.tsx:287-290` |
| Phase toggle button | `32×32` (`size-8`), radius `8px` | `theme-toggle.tsx:1557` |
| Theme menu | `168px` wide, `4px` padding, `2px` row gap, rows `44px` | `theme-toggle.tsx:1569`, `:1589` |
| Menu icons | `16px` | `theme-toggle.tsx:785` region; `GlyphIcon` `width/height="16"` at `:156-157` |

## Breakpoints and media conditions

| Condition | Where |
| --- | --- |
| `375px` | design reference for `--text-title-sm`, tracker and card sizes |
| `min-width: 559px` → contact grid 4 columns (below it 3) | `src/components/work/reader.css:973` |
| `min-width: 768px` | `md`: home carousel, 32px frame pad, 16px panel inset, rail absent, hero radius |
| `min-width: 1024px` | `lg`: rail, margin notes, 360px carousel, panel inset |
| `min-width: 1280px` | `xl`: 60px frame pad, 416px carousel, 753/180/83/84 slots |
| `min-width: 1440px` | frame lines and spotlight (`src/components/home/home-layout.tsx:121`; `src/components/home/frame-line-spotlight.css:19`) |
| `max-width: 1023px` | thumb targets replace the rail (`reader.css:215`) |
| `max-width: 559px` | 3-column contact sheet (`reader.css:973`) |
| `(hover: hover) and (pointer: fine)` | hover states: ring, glide, peek, spotlight, ruler |
| `(pointer: coarse)` | +6px invisible hit areas on nav items, segments, glyph (`src/components/home/nav-items.css:107-120`; `src/components/theme/theme-toggle.css:361-369`) |
| `height` (`dvh`) | `--frame-gap`, nav top, panel max height |
| `prefers-reduced-motion` / `prefers-reduced-transparency` | motion drops / blur-stack fallback |

No `@theme` overrides of `--breakpoint-*` exist; these are Tailwind's defaults plus the explicit
arbitrary variants above.

## Mobile gate

Below `768px` the root layout paints one full-screen dialog instead of the pages while the mobile
layouts are being built; `/dev/*` is the only exclusion. It reuses the boundary screens' column
(`MessageColumn`); the gate's block is centered as a whole with an auto margin (not
`justify-content`, which clips tall content), with its text left-aligned. A wide load never mounts
its horizon.

| Item | Value | Source |
| --- | --- | --- |
| Breakpoint | `max-width: 767.98px`; visibility follows the viewport only | `src/components/system/mobile-gate.css` |
| Exclusion | the component returns `null` when `usePathname()` starts with `/dev` | `src/components/system/mobile-gate.tsx` |
| Layer | `fixed`, `inset: 0`, `z-index: 70` — above the drawer (`50`) and nav dock (`60`) | `mobile-gate.css` |
| Lock | `html`/`body` get `overflow: hidden`, `.wd-nav-dock` is hidden; the gate scrolls itself | `mobile-gate.css` |
| Safe area | `padding: env(safe-area-inset-*)` | `mobile-gate.css` |
| Horizon | client-only `HorizonLive`, mounted once `matchMedia("(max-width: 767.98px)")` matches | `mobile-gate.tsx` |
| Bypass | click stores `sessionStorage["mobile-gate:desktop"] = "1"`, sets `data-desktop-view` on `<html>` and the viewport meta to `width=1280`; the pre-paint script restores both on reload | `mobile-gate.tsx`; `src/app/layout.tsx` |
| Narrow desktop | desktop browsers ignore the meta, so the next frame still matches under 768: the flag and marker are cleared and the button becomes a "window is too narrow" line; widening past 768 hides the gate by CSS | `mobile-gate.tsx`; `mobile-gate.css` |

## Derived relationships present in the code

| Derived value | Expression | Source |
| --- | --- | --- |
| Carousel unit | `(100% − 36px) / (c0+c1+c2+c3)` | `home-carousel.css:18` |
| Carousel slot left/width | `c-off + u·Σc + 12n`, `u·cn` | `home-carousel.css:217-237` |
| Peek shift | `lastSlot.w + gap` | `src/components/home/carousel/hover-peek.ts:112` |
| Peek fade widths | `max(8, round(slot.w · 40 / 100))` | `src/components/home/carousel/home-carousel.tsx:1788-1799` |
| Nav dock top | `max(pad + offset, 50dvh + offset/2 − 2rem)` | `nav-dock.css:20-23` |
| Nav dock width | `min(1136, 100% − 2·pad)` | `nav-dock.css:25` |
| Frame gap | `clamp(0, (100dvh − 780)/2, 64)` | `home-layout.tsx:24` |
| Column top / rail top / scroll margin | `nav inset + nav height + content gap` | `reader.css:66-69`, `:122-124`; `scroll-ruler.css:207-211` |
| Ring inner radius | `--radius-lg − 1px` | `ring-hover.css:26` |
| Ruler gap | `max(40, (room − width)/2)`, then `room − gap − width` written to `--wd-ruler-right` | `scroll-ruler.tsx:354-357` |
| Hero scale | `689 = 753 − 2·32`; shift/scale by `753/689` | `reader.css:427-432` |
| Blur stack height | `nav inset + nav height` | `src/components/work/reader.tsx:43` |
| Card fade stops | reach `74% × 54%`, intensity `96%`, falloff `80%`, mix at `100/90/50%` of intensity and `0.375/0.6875` of falloff | `src/components/home/home-cards.css:13-39` |
| Toggle track width | `segments · 34 + 4` | `theme-toggle.tsx:281-283` |
| Faux-UI scale | container width / 753; cover uses `max(w/753, h/416)` | `src/components/faux-ui/faux-ui.css:41-49` |

## Derived in JS

| Case | What is measured | Source |
| --- | --- | --- |
| Carousel after first measure | slot boxes in px, then `data-ready` stops the CSS ratios applying | `home-carousel.css:4-9`; `src/components/home/carousel/carousel-dom.ts` |
| Nav dock home position | `[data-nav-slot]` top, corrected when off by > `0.5px` | `src/components/nav/nav-dock.tsx:36`, `:195-219` |
| Ruler right offset | available room beside the column | `scroll-ruler.tsx:344-357` |
| Blur stack height | passed as a `calc()` string, not a number | `src/components/work/reader.tsx:43` |

## Notes

- The home band heights (`420/560/360/416`) and the nav offsets (`824/804/604/716`) are independent
  literals, not one scale.
- `--wd-nav-offset` at 375 is the one term that does not equal the comment's own sum; recorded above
  as it is.
- The reader's 582px column is 550px of measure plus two 16px gutters, while the measure itself is
  capped again at `68ch` for body text.
