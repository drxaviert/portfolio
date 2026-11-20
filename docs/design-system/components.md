# Components — key dimensions and tokens (2026-11-18)

The shipped geometry of the nav, the theme toggle, the home cards and tracker, and the work drawer and
carousel, plus the stacking order they share. Values are the ones in the source; the detailed tables
for spacing, radii, shadows and type live in [spacing-layout.md](./spacing-layout.md),
[radii-shadows-borders.md](./radii-shadows-borders.md) and [typography.md](./typography.md), and motion
lives in [motion.md](./motion.md).

## Nav

The same `HomeNav` is the home bar and the reader's top row; one dock in the root layout positions it.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Bar height | `64px` (`h-16`) | `src/components/home/home-nav.tsx:50` | `--wd-nav-height: 4rem` (`src/app/globals.css:210`) |
| Bar inline padding | `16px` (`px-4`) | `home-nav.tsx:50` | — |
| Bar radius | `12px` (`rounded-lg`) | `home-nav.tsx:50` | `--radius-lg` |
| Bar fill | `surface-container-low` | `home-nav.tsx:55` | `--surface-container-low` |
| Bar edge and shadow | 1px `frame-line` ring + `shadow-card` on the host | `src/components/home/ring-hover.css:35`, `:46`, `:62-67` | `--frame-line`, `--shadow-card` |
| Gap, item run → toggle | `12px` (`gap-3`) | `home-nav.tsx:65` | — |
| Nav slot on the home page | `64px` (`h-16`) | `src/components/home/home-layout.tsx:204` | — |
| Orb | `36px` (`size-9`), `50%` radius | `home-nav.tsx:32` | `--orb-gradient` |
| Orb eyes | `8 × 3.4px`, top `10.5px`, left `13.5px` / `20.6px`, white | `home-nav.tsx:35-36` | — |
| Item | `32px` high (`h-8`), `8px` inline padding (`px-2`), `8px` radius (`rounded-md`) | `src/components/home/nav-items.tsx:25` | `--radius-md` |
| Item type | `16px` / `20px` (`leading-5`) / `500` | `nav-items.tsx:26` | `--text-base` |
| Glyph | `32 × 32px` (`size-8`), `8px` radius | `nav-items.tsx:37` | `--radius-md` |
| Divider | `1 × 20px`, `24px` each side (`mx-6`) | `nav-items.tsx:539` | `--outline-variant` |

### Nav dock

| Item | Value | Source |
| --- | --- | --- |
| `--wd-frame-pad` | `16px`; `md` `32px`; `xl` `60px` | `src/components/nav/nav-dock.css:16`, `:39`, `:52` |
| `--wd-nav-offset` | `824px`; `md` `804px`; `lg` `604px`; `xl` `716px` | `nav-dock.css:17`, `:40`, `:46`, `:53` |
| Top | `max(calc(var(--wd-frame-pad) + var(--wd-nav-offset)), calc(50dvh + var(--wd-nav-offset) / 2 - 2rem))` | `nav-dock.css:20-23` |
| Left | `max(var(--wd-frame-pad), calc(50% - 568px))` | `nav-dock.css:24` |
| Width | `min(1136px, 100% - var(--wd-frame-pad) * 2)` | `nav-dock.css:25` |
| z-index | `60` | `nav-dock.css:28` |
| Reader position | `fixed`, `top: calc(var(--wd-panel-inset) + var(--wd-nav-inset))` | `nav-dock.css:59-62` |

The offset is described in the file as tracker + 12px gap + card band + 12px gap (`nav-dock.css:9-12`);
the literal at 375 (`824px`) does not equal that sum (`604px`), and the dock corrects against
`[data-nav-slot]` at runtime when it is off by more than `0.5px`
(`src/components/nav/nav-dock.tsx:205-220`).

## Theme toggle

The toggle is `Day · Night · Auto`. A four-segment Day-phase row (`Clock · Dawn · Midday · Dusk`) is
rendered for every mode and opens above the toggle; switching to Day applies the pin
(`src/components/theme/theme-toggle.tsx:1500-1528`, `src/lib/theme.ts:64-65`). Below 768 the toggle is
one button and the menu carries both sets.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Modes | `Day`, `Night`, `Auto` (3 segments) | `src/components/theme/theme-toggle.tsx:36-40` | — |
| Day phases | `Clock`, `Dawn`, `Midday`, `Dusk` (4 segments) | `theme-toggle.tsx:48-57` | — |
| Segment width constant | `34px`; track inset `4px` | `theme-toggle.tsx:278-279` | — |
| Track width | `segments × 34px + 4px` → `106px` (3), `140px` (4) | `theme-toggle.tsx:281-283` | — |
| Track height | `32px` (`h-8`), `2px` padding (`p-0.5`) | `theme-toggle.tsx:699` | — |
| Track radius | `8px` (`rounded-md`) | `theme-toggle.tsx:699` | `--radius-md` |
| Track fill / selected fill | `toggle-track` / `toggle-selected` | `theme-toggle.tsx:575`, `:699` | `--toggle-track`, `--toggle-selected` |
| Segment | `28px` high (`h-7`), `6px` radius | `theme-toggle.tsx:571` | — |
| Selection pill | `28px` high, `6px` radius, `2px` inside the track | `theme-toggle.tsx:287-290` | — |
| Phase-row gap | `4px` | `src/app/globals.css:212` | `--wd-phase-row-gap` |
| Phase row anchor (home) | absolute, `right: 0`, `bottom: 100%`, `shadow-card` | `theme-toggle.tsx:1527` | `--shadow-card` |
| Compact trigger (<768) | `32 × 32px` (`size-8`), `8px` radius, `toggle-track` fill, `shadow-card` | `theme-toggle.tsx:1557` | `--toggle-track`, `--shadow-card` |
| Menu (<768) | `168px` wide, `4px` padding (`p-1`), `2px` row gap (`gap-0.5`), `12px` radius, `surface-container-low`, `shadow-card`, `z-index: 3`, max-height `calc(100dvh - 4rem)` | `theme-toggle.tsx:1569` | `--surface-container-low`, `--shadow-card` |
| Menu row | `44px` high (`h-11`), `12px` inline padding (`px-3`), `8px` gap, `8px` radius | `theme-toggle.tsx:1589` | `--radius-md` |
| Menu row, phase | `44px` high, `32px` start padding (`pl-8`) | `theme-toggle.tsx:1618` | `--radius-md` |
| Row fill | selected `surface-container-high`; hover `surface-container` | `theme-toggle.tsx:1592-1593` | `--surface-container-high`, `--surface-container` |
| Icons | `16 × 16px`, stroke `1.4` | `theme-toggle.tsx:155-160` | — |
| Focus ring | `2px` `primary`, offset `0` (track) / `2px` (trigger) / `-2px` (rows) | `theme-toggle.tsx:573`, `:1557`, `:1590` | `--primary` |

The `34px` segment is the Figma `104px` track (3 × 33.33px) rounded up so every segment centre lands
on an integer and the `106px` and `140px` tracks right-align (`theme-toggle.tsx:272-279`).
`34px` also makes the track `2px` wider than the Figma frame; the `2px` inset is what the pill sits in.

## Home cards, tracker and top band

| Item | 375 | `md` (768) | `lg` (1024) | `xl` (1280) | Source |
| --- | --- | --- | --- | --- | --- |
| Tracker card | `160 × 160` | `220 × 220` | `220 × 220` | `276h × 275w` | `src/components/home/tracker-widget.tsx:77` |
| Tracker card padding | `22px` block | `26px` top | same | same | `tracker-widget.tsx:77` |
| Tracker grid width | `98px` | `165px` | `165px` | `223px` | `tracker-widget.tsx:80`, `:84` |
| Tracker cell gap | `3px` | `3px` | `3px` | `3px` | `tracker-widget.tsx:53`, `:64` |
| Gap between tracker bands | — | `9px` | `9px` | `9px` | `tracker-widget.tsx:84` |
| Tracker pager dot | `6px`, `6px` gap | same | same | same | `tracker-widget.tsx:89-93` |
| Featured card / band height | `420px` | `560px` | `360px` | `416px` | `src/components/home/home-layout.tsx:159`, `:182` |
| Featured card padding | `20px` (`p-5`) | `32px` (`md:p-8`) | same | same | `src/components/home/home-cards.tsx:62` |
| Featured card radius | `12px` (`rounded-lg`) | same | same | same | `home-cards.tsx:62` |
| Sliver heights | `72px`, `56px`, `56px` | auto (`md:h-auto`) | auto | auto | `home-cards.tsx:20-30`, `:148` |
| Card fade inset | `32px` (`inset-8`), `8px` radius | same | same | same | `home-cards.tsx:86` |
| Nav slot | `64px` | same | same | same | `home-layout.tsx:204` |
| Play card (`/play`) | `849 × 276px` | same | same | same | `src/components/play/play-card.tsx:30` |

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Tracker card fill | `surface-container-low` | `tracker-widget.tsx:79` | `--surface-container-low` |
| Tracker card radius | `12px` (`rounded-lg`) | `tracker-widget.tsx:77` | `--radius-lg` |
| Tracker cell radius | `2px` (`rounded-xs`) | `tracker-widget.tsx:45` | `--radius-xs` |
| Tracker cell fills | `tracker-0` … `tracker-4` | `tracker-widget.tsx:14-20` | `--tracker-0` … `--tracker-4` |
| Featured card fill | `surface-container-low` | `home-cards.tsx:73` | `--surface-container-low` |
| Card title below `md` | `32px / 1.1`, `-0.01em`, weight `600` | `home-cards.tsx:92` | `--text-title-sm` |
| Card title at `md`+ | `40px / 1.1`, `-0.01em`, weight `600` | `home-cards.tsx:92` | `--text-title` |
| Card title clamp | 3 lines | `src/components/home/home-cards.css:46-51` | — |
| Card fade | `96%` intensity, `74% × 54%` reach, `80%` falloff | `home-cards.css:12-16` | `--surface-dim` |
| Card layer order | scene `z-0`, fade `z-1`, title `z-10` | `home-cards.tsx:78`, `:86`, `:92` | — |
| Sliver fills | `surface-container`; `surface` / `surface-container-high` / `surface-container-highest` in Night | `home-cards.tsx:20-30` | surface roles |
| Top band | tracker card + `12px` gap + play shell at `275 + 12 + 849` in the 1440 frame | `home-layout.tsx:137-153` | — |
| Empty-work band | `420 / 560 / 360 / 416px` | `home-layout.tsx:156-163` | — |

## Work drawer and carousel

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Drawer layer | `fixed`, `inset: 0`, `z-index: 50` | `src/components/work/expand-shell.css:25-28` | — |
| Backdrop | `rgb(8 8 8 / 0.4)`; Night `rgb(0 0 0 / 0.62)` | `expand-shell.css:34`, `:40` | — |
| Panel at `md`+ | `12px` radius; `shadow-card` + `0 30px 70px -30px rgb(0 0 0 / 0.45)` | `src/components/work/reader.css:23-29` | `--shadow-card` |
| Panel inset | `0px`; `md` `16px` | `src/app/globals.css:208`, `:217` | `--wd-panel-inset` |
| Nav inset | `16px`; `md` `28px` | `globals.css:209`, `:218` | `--wd-nav-inset` |
| Nav height | `64px` (`4rem`) | `globals.css:210` | `--wd-nav-height` |
| Nav → content gap | `24px`; `md` `32px` | `globals.css:211`, `:219` | `--wd-nav-content-gap` |
| Column | `max-width: 582px` (`550px` measure + `2 × 16px` gutters) | `reader.css:63` | — |
| Column padding | top `nav inset + nav height + content gap`, inline `16px`, bottom `64px` | `reader.css:66-69` | `--wd-*` |
| Column bottom, no rail | `88px` below 1024 | `reader.css:246-249` | — |
| Body measure | `68ch` | `reader.css:492-502` | `--text-base` |
| Rail at `lg`+ | `170px` wide, `right: calc(100% + 4px)`, `z-index: 1` | `reader.css:93-107` | — |
| Thumb targets below `lg` | `44 × 44px`, `999px` radius, `z-index: 1` | `reader.css:215-235` | `--surface-container-low`, `--shadow-card` |
| Hero | `689 / 352` aspect, `12px` radius | `reader.css:420-424` | — |
| Blur stack | height `nav inset + nav height`; six bands `1/2/4/8/16/32px`; `z-index: 1` | `src/components/work/reader.tsx:43`; `src/components/work/blur-stack.css:26`, `:57-92` | `--wd-nav-inset`, `--wd-nav-height` |
| Blur stack props | `edge="bottom"` sets `data-edge="bottom"` and flips the band masks to build toward the bottom edge (default top); `tint={false}` sets `data-tint="none"` and drops the panel-surface gradient under the bands (the homepage edge bands use it so the glow keeps its colour); `--wd-blur-height` sets the stack height, falling back to `100%` of the containing block | `src/components/work/blur-stack.tsx:12-41`; `blur-stack.css:27`, `:101`, `:116` | `--wd-blur-height` |
| Drawer return focus | after the drawer closes, focus returns to its trigger (card, or the nav's Work item) and the focus ring shows only if the last input was keyboard navigation (Tab, Enter, Space, arrows, Home/End, PageUp/PageDown); a pointer press, or Esc or modifiers alone, counts as pointer, so a mouse close leaves no ring (PR #78) | `src/components/nav/input-modality.ts:48`; `src/components/work/drawer-shell.tsx:234` | none |
| Ruler | `18px` wide, `z-index: 2` | `src/components/work/scroll-ruler.css:18`, `:23` | — |
| Carousel row height | `560px`; `lg` `360px`; `xl` `416px` | `src/components/home/carousel/home-carousel.css:25`, `:39`, `:50` | — |
| Carousel slots | `444/120/52/52`; `lg` `656/140/64/64`; `xl` `753/180/83/84` | `home-carousel.css:12-15`, `:34-37`, `:45-48` | — |
| Carousel gap | `12px` | `home-carousel.css:60` | — |
| Carousel unit | `calc((100% - 36px) / (c0 + c1 + c2 + c3))`; `36px` is three `12px` gaps | `home-carousel.css:17` | — |
| Card shadow pad | `8px` | `home-carousel.css:22` | — |
| Title inset | `32px` left / right / bottom, 3-line clamp | `home-carousel.css:197-208` | `--text-title` |
| Edge mask | `28px` fade starting `12px` in; mask `24px` larger, at `-12px -12px` | `home-carousel.css:303-317` | — |
| Edge blur | `2.5px` | `src/components/home/carousel/edge-blur.ts:15-18` | — |
| Hover peek | reach `32px` / outside `24px`; reveal `450ms`, retract `350ms`, leave `120ms`; fade `40%` of card (min `8px`); max blur `8px` | `src/components/home/carousel/hover-peek.ts:33-43`; `src/components/home/carousel/home-carousel.tsx:1788-1799` | — |
| Hovered slide | `z-index: 2` | `home-carousel.css:130-133` | — |

The `36px` taken off the carousel row is three `12px` gaps (`home-carousel.css:17`, `:60`); the edge
mask's `28px` fade starts `12px` in from the row's edge (`:303-317`). The `60px` frame pad at `xl` is a
term in the nav's top calculation (`nav-dock.css:20-23`, `:52`).

## Work index (/work)

The index lives in the drawer panel, under the same nav, in the reader's own column geometry. It carries the grid / list switch beside the title and renders both layouts; `data-work-layout` on `<html>` picks one (grid default). Cards use the shadow, never a stroke; hover is guarded by `(hover: hover) and (pointer: fine)`.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Column | `max-width: 1184px`; top `nav inset + nav height + content gap`; inline `16px`, `md` `32px`; bottom `64px` + safe area | `src/components/work/work-index.css:19-34` | `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
| Title | `--text-title-sm` (`md`+ `--text-title`), weight 600, with their own leading and tracking | `work-index.css:78-94` | `--text-title(-sm)`, `--text-title(-sm)--line-height`, `--text-title(-sm)--letter-spacing` |
| Count | `--text-sm`, `--on-surface-variant` | `work-index.css:96-100` | `--text-sm` |
| Layout switch | two-segment icon radiogroup, the theme toggle's `SegmentTrack` / `Segment`, 40px finger target | `src/components/work/layout-toggle.tsx` | none |
| Grid | `1 / 2 / 3` columns at `<640` / `640` / `1024`, `16px` gap | `work-index.css:123-142` | none |
| Grid card | `ring-host` link, `--radius-lg`, `bg-surface-container` ring fill, cover `4 / 3` with `--radius-lg` top corners, meta padding `12px 16px 20px`, title `--text-lg` / 500, sub `--text-sm` | `work-index.css:144-183`; `src/components/work/work-grid.tsx` | `--radius-lg`, `--surface-container(-high)`, `--text-lg` |
| Grid hover | cover scene `scale(1.02)`, `--duration-long-2` `--ease-spring-follow`, fine pointer and no reduced motion only | `work-index.css:185-194` | `--duration-long-2`, `--ease-spring-follow` |
| List row | grid `4.5rem / 1fr / auto` (`md`+ `5rem / 1fr / 10rem`), `16px 16px` padding, `--radius-lg`; hover fill `--surface-container` over 180ms (fine pointers only); `:focus-visible` fill on every pointer type | `work-index.css:205-262`, `:296-308`; `src/components/work/work-index-list.tsx` | `--duration-short-6`, `--ease-decelerate` |
| List preview | from `1024`: `180px` wide, `16 / 10`, `--radius-md`, `--shadow-card`, fades and scales `0.98 → 1` on hover / focus-visible; the row's `212px` right padding reserves its slot | `work-index.css:265-325` | `--radius-md`, `--shadow-card` |
| Forced colours | grid card and preview get a `1px CanvasText` border | `work-index.css:327-336` | none |

Motion: the arrival fade and the layout switch are in `motion.md`, "Work index".

## Layering (z-index)

Only the values that are written. The ring layers use negative indices inside an `isolation: isolate`
host, so they stay under their own card rather than under the page.

| Layer | z-index | Source |
| --- | --- | --- |
| Ring frame / ring surface | `-2` / `-1` inside the host | `src/components/home/ring-hover.css:65`, `:117` |
| Nav item, nav glyph (above the glide pill) | `1` | `src/components/home/nav-items.css:10` |
| Nav glide pill | `0` | `nav-items.css:41` |
| Blur stack (over reader content, under nav) | `1` | `src/components/work/blur-stack.css:26` |
| Reader rail (`lg`+) | `1` | `src/components/work/reader.css:101` |
| Reader thumb targets (<`lg`) | `1` | `reader.css:219` |
| Ruler | `2` | `src/components/work/scroll-ruler.css:23` |
| Hovered / focused ring host (card, nav bar) | `1` (transitioned `100ms steps(1)`) | `ring-hover.css:47`, `:132`, `:190` |
| Nav raised while the phase row is open | `2` | `src/components/theme/theme-toggle.css:13` |
| Theme menu (<768) | `3` | `src/components/theme/theme-toggle.tsx:1569` |
| Hovered / focused carousel slide | `2` | `home-carousel.css:132` |
| Carousel peek blur copy | `2` | `home-carousel.css:749` |
| Card scene / fade / title | `0` / `1` / `10` | `src/components/home/home-cards.tsx:78`, `:86`, `:92` |
| Carousel title | `10` | `home-carousel.css:202` |
| Entrance veil | `10` | `src/components/home/home-entrance.css:44` |
| Drawer layer and backdrop | `50` | `src/components/work/expand-shell.css:27` |
| Nav dock | `60` | `src/components/nav/nav-dock.css:28` |
| View-transition old root | `1` | `src/app/globals.css:109` |
| Faux-UI cursor / panel (inside the 753 × 416 scene) | `6` / `50` | `src/components/faux-ui/faux-ui.css:313`, `:904-912` |

Reduced motion drops the ring host's raise to `auto` (`ring-hover.css:263-267`); the ring still opens
inside the card's box.

## Tokens each component reads

| Component | Tokens |
| --- | --- |
| Nav | `--surface-container-low`, `--surface-container`, `--shadow-card`, `--frame-line`, `--outline-variant`, `--orb-1/2/3`, `--orb-2-at`, `--orb-gradient`, `--radius-md`, `--radius-lg`, `--text-base`, `--primary` (focus) |
| Theme toggle | `--toggle-track`, `--toggle-selected`, `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--on-surface`, `--on-surface-variant`, `--primary`, `--shadow-card`, `--radius-md`, `--radius-lg`, `--text-base`, `--wd-phase-row-gap` |
| Home cards and tracker | `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--surface-container-highest`, `--surface-dim`, `--tracker-0` … `--tracker-4`, `--text-title`, `--text-title-sm`, `--radius-xs`, `--radius-lg`, `--shadow-card`, `--frame-line` |
| Work drawer and carousel | `--surface-container-low`, `--surface-container-highest`, `--shadow-card`, `--frame-line`, `--outline-variant`, `--primary`, `--radius-lg`, `--text-xs` … `--text-lg`, `--text-title`, `--text-title-sm`, `--wd-panel-inset`, `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
