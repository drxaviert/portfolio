# Components — key dimensions and tokens (2026-11-22)

The shipped geometry of the nav, the theme toggle, the home cards and tracker, and the work drawer and
carousel, plus the stacking order they share. Values are the ones in the source; the detailed tables
for spacing, radii, shadows and type live in [spacing-layout.md](./spacing-layout.md),
[radii-shadows-borders.md](./radii-shadows-borders.md) and [typography.md](./typography.md), and motion
lives in [motion.md](./motion.md).

## Nav

The same `HomeNav` is the home bar and the reader's top row; one dock in the root layout positions it.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Bar height | `64px` (`h-16`) | `src/components/home/home-nav.tsx:42` | `--wd-nav-height: 4rem` (`src/app/globals.css:210`) |
| Bar inline padding | `16px` (`px-4`) | `home-nav.tsx:42` | — |
| Bar radius | `12px` (`rounded-lg`) | `home-nav.tsx:42` | `--radius-lg` |
| Bar fill | `surface-container-low` | `home-nav.tsx:47` | `--surface-container-low` |
| Bar edge and shadow | 1px `frame-line` ring + `shadow-card` on the host | `src/components/home/ring-hover.css:35`, `:46`, `:62-67` | `--frame-line`, `--shadow-card` |
| Gap, item run → toggle | `12px` (`gap-3`) | `home-nav.tsx:63` | — |
| Nav slot on the home page | `64px` (`h-16`) | `src/components/home/home-layout.tsx:216` | — |
| Orb | `36px`, `50%` radius | `src/components/home/gaze-orb.tsx:258-267` | `--orb-gradient` |
| Orb eyes | `8 × 3.4px`, top `10.5px`, left `13.5px` / `20.6px`, white | `gaze-orb.tsx:27-30`, `:251-278` | — |
| Orb gaze | Eye pair travel `4.5 × 2.8px` at 36px; full look at `60px`; closed-form spring `ω²=566.7`, `ζ=0.91` (`glide-spring`, no Motion in first load); fine pointer only; rests under reduced motion; ignores the theme crossfade's synthetic leave | `gaze-orb.tsx:32-46`, `:88-150`, `:168-228` | — |
| Orb link | `/`, `aria-label="Home"`, `scroll` default; hover fill = the nav's `--nav-hover-fill` at `0.55` in a round capsule; press `scale(0.96)` | `home-nav.tsx:49-61`, `nav-items.css` | `--nav-hover-fill`, `--duration-short-3` |
| Orb tooltip | `Home`, `aria-hidden`, above the orb on `/` and below it in the drawer; 150ms fade after the group's 300ms delay | `home-nav.tsx:55-60`, `nav-items.css` | `--duration-short-3`, `--duration-medium-5` |
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
| Featured card / band height | `420px` | `560px` | `360px` | `416px` | `src/components/home/home-layout.tsx:169`, `:193` |
| Featured card padding | `20px` (`p-5`) | `32px` (`md:p-8`) | same | same | `src/components/home/home-cards.tsx:65` |
| Featured card radius | `12px` (`rounded-lg`) | same | same | same | `home-cards.tsx:65` |
| Sliver heights | `72px`, `56px`, `56px` | auto (`md:h-auto`) | auto | auto | `home-cards.tsx:20-30`, `:152` |
| Card fade inset | `32px` (`inset-8`), `8px` radius | same | same | same | `home-cards.tsx:90` |
| Nav slot | `64px` | same | same | same | `home-layout.tsx:216` |
| Play card (home) | `849 × 276px` at 1440 | same | same | same | the home `PlayCard` is `flex-1` (`src/components/home/home-cards.tsx:193`; cell `min-w-0 flex-1` at `src/components/home/home-layout.tsx:156-162`), so its width is `1136 − 275 − 12 = 849` at 1440 and the height `276` follows the tracker card (`src/components/home/tracker-widget.tsx:77`); `/play` has its own fixed 849×276 at `src/components/play/play-card.tsx:30` |

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Tracker card fill | `surface-container-low` | `tracker-widget.tsx:79` | `--surface-container-low` |
| Tracker card radius | `12px` (`rounded-lg`) | `tracker-widget.tsx:77` | `--radius-lg` |
| Tracker cell radius | `2px` (`rounded-xs`) | `tracker-widget.tsx:45` | `--radius-xs` |
| Tracker cell fills | `tracker-0` … `tracker-4` | `tracker-widget.tsx:14-20` | `--tracker-0` … `--tracker-4` |
| Featured card fill | `surface-container-low` | `home-cards.tsx:77` | `--surface-container-low` |
| Card title below `md` | `32px / 1.1`, `-0.01em`, weight `600` | `home-cards.tsx:96` | `--text-title-sm` |
| Card title at `md`+ | `40px / 1.1`, `-0.01em`, weight `600` | `home-cards.tsx:96` | `--text-title` |
| Card title clamp | 3 lines | `src/components/home/home-cards.css:46-51` | — |
| Card fade | `96%` intensity, `74% × 54%` reach, `80%` falloff | `home-cards.css:12-16` | `--surface-dim` |
| Card layer order | scene `z-0`, fade `z-1`, title `z-10` | `home-cards.tsx:82`, `:90`, `:96` | — |
| Sliver fills | `surface-container`; `surface` / `surface-container-high` / `surface-container-highest` in Night | `home-cards.tsx:20-30` | surface roles |
| Top band | tracker card + `12px` gap + play shell at `275 + 12 + 849` in the 1440 frame | `home-layout.tsx:147-164` | — |
| Empty-work band | `420 / 560 / 360 / 416px` | `home-layout.tsx:167-173` | — |

## Work drawer and carousel

The carousel remembers its position in memory for the life of the document (`src/components/home/carousel/carousel-memory.ts`). `/` and `/work*` mount separate HomeScreen trees, so opening or closing the drawer remounts it; it restarts from the remembered card on its first render, with no step animation. A reload starts from the default card. Nothing is persisted to storage.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Drawer layer | `fixed`, `inset: 0`, `z-index: 50` | `src/components/work/expand-shell.css:25-28` | — |
| Backdrop | `rgb(8 8 8 / 0.4)`; Night `rgb(0 0 0 / 0.62)` | `expand-shell.css:34`, `:40` | — |
| Panel at `md`+ | `12px` radius; `shadow-card` + `0 30px 70px -30px rgb(0 0 0 / 0.45)` | `src/components/work/reader.css:23-29` | `--shadow-card` |
| Panel inset | `0px`; `md` `16px` | `src/app/globals.css:208`, `:217` | `--wd-panel-inset` |
| Nav inset | `16px`; `md` `28px` | `globals.css:209`, `:218` | `--wd-nav-inset` |
| Nav height | `64px` (`4rem`) | `globals.css:210` | `--wd-nav-height` |
| Nav → content gap | `24px`; `md` `32px` | `globals.css:211`, `:219` | `--wd-nav-content-gap` |
| Column | `max-width: 582px` (`550px` measure + `2 × 16px` gutters) | `reader.css` | — |
| Back row | `max-width: 1120px`, inline `16px` / `md` `32px`, top `nav inset + nav height + content gap`; the reading column below has no top padding | `reader.css` | `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
| Column padding | inline `16px`, top `0` (the back row clears the nav), bottom `64px` | `reader.css` | — |
| Column bottom, no rail | `88px` below 1024 | `reader.css` | — |
| Body measure | `68ch` | `reader.css` | `--text-base` |
| Rail at `lg`+ | `170px` wide, `right: calc(100% + 4px)`, `z-index: 1`; the reach-to-top control only | `reader.css` | — |
| Reach-to-top thumb below `lg` | `44 × 44px`, `999px` radius, `z-index: 1`, bottom-right | `reader.css` | `--surface-container-low`, `--shadow-card` |
| Hero | `689 / 352` aspect, `12px` radius | `reader.css:420-424` | — |
| Blur stack | height `nav inset + nav height`; six bands `1/2/4/8/16/32px`; `z-index: 1` | `src/components/work/reader.tsx:43`; `src/components/work/blur-stack.css:26`, `:57-92` | `--wd-nav-inset`, `--wd-nav-height` |
| Blur stack props | `edge="bottom"` sets `data-edge="bottom"` and flips the band masks to build toward the bottom edge (default top); `tint={false}` sets `data-tint="none"` and drops the panel-surface gradient under the bands (the homepage edge bands use it so the glow keeps its colour); `--wd-blur-height` sets the stack height, falling back to `100%` of the containing block | `src/components/work/blur-stack.tsx:12-41`; `blur-stack.css:27`, `:101`, `:116` | `--wd-blur-height` |
| Drawer return focus | after the drawer closes, focus returns to its trigger (card, or the nav's Work item) and the focus ring shows only if the last input was keyboard navigation (Tab, Enter, Space, arrows, Home/End, PageUp/PageDown); a pointer press, or Esc or modifiers alone, counts as pointer, so a mouse close leaves no ring (PR #78) | `src/components/nav/input-modality.ts:48`; `src/components/work/drawer-shell.tsx:234` | none |
| Ruler | `18px` wide, `z-index: 2` | `src/components/work/scroll-ruler.css:18`, `:23` | — |
| Carousel row height | `560px`; `lg` `360px`; `xl` `416px` | `src/components/home/carousel/home-carousel.css:26`, `:40`, `:51` | — |
| Carousel slots | `444/120/52/52`; `lg` `656/140/64/64`; `xl` `753/180/83/84` | `home-carousel.css:13-16`, `:35-38`, `:46-49` | — |
| Carousel gap | `12px` | `home-carousel.css:61` | — |
| Carousel unit | `calc((100% - 36px) / (c0 + c1 + c2 + c3))`; `36px` is three `12px` gaps | `home-carousel.css:18` | — |
| Card shadow pad | `8px` | `home-carousel.css:23` | — |
| Title inset | `32px` left / right / bottom, 3-line clamp | `home-carousel.css:203-214` | `--text-title` |
| Edge mask | `28px` fade starting `12px` in; mask `24px` larger, at `-12px -12px` | `home-carousel.css:309-323` | — |
| Edge blur | `2.5px` | `src/components/home/carousel/edge-blur.ts:15-18` | — |
| Hover peek | reach `32px` / outside `24px`; reveal `450ms`, retract `350ms`, leave `120ms`; fade `40%` of card (min `8px`); max blur `8px` | `src/components/home/carousel/hover-peek.ts:33-43`; `src/components/home/carousel/home-carousel.tsx:1788-1799` | — |
| Hovered slide | `z-index: 2` | `home-carousel.css:131-139` | — |

The `36px` taken off the carousel row is three `12px` gaps (`home-carousel.css:18`, `:60`); the edge
mask's `28px` fade starts `12px` in from the row's edge (`:303-317`). The `60px` frame pad at `xl` is a
term in the nav's top calculation (`nav-dock.css:20-23`, `:52`).

## Work index (/work)

The index lives in the drawer panel, under the same nav, in the reader's own column geometry. It is one list of studies: while a row is hovered — or keyboard-focused with no pointer — one 480x360 thumbnail follows or parks, the other rows drop to 40%, and the dividers around the current row fade. There is no grid, no layout switch and no per-row preview.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Column | `max-width: 1120px`; top `nav inset + nav height + content gap`; inline `16px`, `md` `32px`; bottom `96px` + safe area | `work-index.css` | `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
| Row | grid `80px / 1fr / 200px`, `16px` gap, `18px 16px` padding, 12px radius; hover fill `--surface-container` over 200ms | `work-list.css`, `work-list.tsx` | `--text-xl`, `--text-sm`, `--surface-container`, `--on-surface-variant` |
| Divider | `1px` `--outline-variant`, `16px` in from the row's text edges; none above the first row; the current row and the row after fade theirs over 200ms | `work-list.css` | `--outline-variant` |
| Row dim | non-current row child `opacity: 0.4`, 200ms with an 80ms grace between rows; the divider stays at full opacity | `work-list.tsx`, `work-list.css` | `--ease-emphasized-decelerate` |
| Thumbnail | `480 × 360`, `--radius-lg`, `--shadow-card`, no border; the inner layer enters from `opacity: 0.6` and `scale(0.96)` | `work-list.tsx`, `work-list.css` | `--radius-lg`, `--shadow-card` |
| Thumbnail layer | fixed `inset: 0`, viewport clip only, `z-index: 70` above the nav, `pointer-events: none`, portalled to `<body>`, follows the cursor 1:1 with one rAF `translate3d` per frame | `work-list.tsx`, `work-list.css` | none |
| Cursor | `none` only over a hovered row that owns the thumbnail; normal on the nav, the rest of the page and for keyboard focus | `work-list.css` | none |
| Reduced motion | thumbnail opacity only over 120ms, row dim and divider fades 120ms, no entrance; tracking stays 1:1 | `work-list.css` | none |
| Touch | no thumbnail | `work-list.css` | none |
| Forced colours | thumbnail gets a `1px CanvasText` border | `work-list.css` | none |

Motion: in `motion.md`, "Work index — hover thumbnail list".

### Ways home

Both sides of the drawer use one `Breadcrumb` (`src/components/work/breadcrumb.tsx`), built from the home nav's items and its shared Glide capsule. It sits at the same rectangle — the top-left of the content area, below the nav, with the first segment on the list's year-column edge — so the control does not move when a study opens or the index comes back.

| Item | Value | Source | Tokens |
| --- | --- | --- | --- |
| Position | index: first child of the 1120px list column; reader: a matching 1120px back row above the 582px reading column; both with the same top clearance and 16/32px inline padding | `src/components/work/breadcrumb.css`, `work-index.css`, `reader.css` | `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
| Alignment | wrapper `margin-left: 8px` + item `padding-left: 8px`; the first segment's ink lands on the year column's x | `breadcrumb.css`, `work-list.css` | — |
| Row | `32px` high, no vertical padding; the same row as the nav item | `breadcrumb.css`, `nav-item-class.ts` | — |
| Item | `32px` high, `0 8px` padding, `8px` radius, `16px` / `500` / `on-surface-variant`; current and hover → `on-surface` | `nav-item-class.ts`, `nav-items.css` | `--text-base`, `--radius-md`, `--on-surface-variant`, `--on-surface` |
| Current | the `aria-current="page"` segment stays at the links' `500` and is marked by `on-surface` ink plus a `1px` underline in `currentColor`, `4px` below the baseline, with `text-decoration-skip-ink: auto`; it is static, so it has no hover state. Links carry no underline | `breadcrumb.css` | `--text-base`, `--on-surface` |
| Hover motion | the nav's `GlideCapsule` unchanged: the same two spring edges, leading/trailing timing and `0.55` `--nav-hover-fill` capsule; focus is the nav item's `2px` `primary` ring at offset `0` | `src/components/home/glide-capsule.tsx`, `nav-items.css` | `--nav-hover-fill`, `--primary` |
| Reduced motion | no capsule travel; the hovered item crossfades the same `--nav-hover-fill` at `0.55` in `120ms` | `nav-items.css` | `--nav-hover-fill`, `--duration-short-2` |
| Separator | `/` at `16px` / `400` in `on-surface-variant` (the resting "Home" ink; `8.59:1` Day / `8.29:1` Night); the items' own `8px` padding leaves the nav's `16px` gap on either side | `breadcrumb.css` | `--text-base`, `--on-surface-variant` |
| Index content | Home / Work; Home is a link, Work is static with `aria-current="page"` | `breadcrumb.tsx` | — |
| Reader content | Home / Work / the study title; the title is static with `aria-current="page"` and clips to `240px` with an ellipsis | `breadcrumb.tsx`, `breadcrumb.css` | — |
| Index action | Home runs the drawer's `exit` (step-back-or-close, generation + 350ms burst guards); a plain click is prevented, a modified click follows the `/` href | `breadcrumb.tsx`, `drawer-shell.tsx` | — |
| Reader actions | Home closes the whole drawer to `/`; Work runs `stepBack`: history back when the index is the entry behind, else `/work`, with the panel and the list's scroll kept; modified clicks follow the hrefs | `breadcrumb.tsx`, `use-morph.ts` | — |
| Index entrance | the list's Soft-focus: `opacity: 0` while `data-phase="opening"`, then `wd-work-soft` 700ms with no delay; the rows follow their own 40ms stagger | `work-list.css` | `--ease-calm` |
| Reader entrance | rides the scroll column's reveal; the component has no animation of its own | `entrance.css`, `reader.css` | — |
| Landmark | `<nav aria-label="Breadcrumb"><ol>`; separators are `aria-hidden`; Home and Work are links, the current segment is not | `breadcrumb.tsx` | — |
| Orb on `/work*` | clicking it runs the drawer close (the dock captures the link) and lands on `/` | `src/components/nav/nav-dock.tsx` | — |
| Orb on `/` | a no-op link: no history entry and no scroll jump | `nav-dock.tsx` | — |

The current segment is marked by its darker colour and an underline, not by
weight: it keeps the links' `font-medium` (`500`) and gains a `1px` underline in
`currentColor` (`on-surface`) at a `4px` offset, with
`text-decoration-skip-ink: auto` so descenders stay clear. It is static, so it
has no hover response; links carry no underline and keep the glide capsule
hover unchanged. The underline adds no box, so the row stays `32px` and Home
does not move.

The index Breadcrumb's Home link is the panel's first focusable, so the tab trap restarts a stranded heading's navigation on it: Tab from the focused `Work` title reaches it. In the reader it is the first focusable in the scroll column. The reader keeps its reach-to-top controls (the desktop rail's `↑ Top` and the thumb button below `lg`); only the way back moved.

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
| Hovered / focused carousel slide | `2` | `home-carousel.css:132`, `:137` |
| Carousel peek blur copy | `2` | `home-carousel.css:757` |
| Card scene / fade / title | `0` / `1` / `10` | `src/components/home/home-cards.tsx:82`, `:90`, `:96` |
| Carousel title | `10` | `home-carousel.css:208` |
| Entrance veil | `10` | `src/components/home/home-entrance.css:44` |
| Drawer layer and backdrop | `50` | `src/components/work/expand-shell.css:27` |
| Nav dock | `60` | `src/components/nav/nav-dock.css:28` |
| Work hover thumbnail (above the nav, below nothing) | `70` | `src/components/work/work-list.css` |
| View-transition old root | `1` | `src/app/globals.css:109` |
| Faux-UI cursor / panel (inside the 753 × 416 scene) | `6` / `50` | `src/components/faux-ui/faux-ui.css:313`, `:904-912` |

Reduced motion drops the ring host's raise to `auto` (`ring-hover.css:263-267`); the ring still opens
inside the card's box.

## Tokens each component reads

| Component | Tokens |
| --- | --- |
| Nav | `--surface-container-low`, `--surface-container` (hover fill base, current item), `--on-surface` (hover ink, label hover), `--shadow-card`, `--frame-line`, `--outline-variant`, `--orb-1/2/3`, `--orb-2-at`, `--orb-gradient`, `--radius-md`, `--radius-lg`, `--text-base`, `--primary` (focus) |
| Theme toggle | `--toggle-track`, `--toggle-selected`, `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--on-surface`, `--on-surface-variant`, `--primary`, `--shadow-card`, `--radius-md`, `--radius-lg`, `--text-base`, `--wd-phase-row-gap` |
| Home cards and tracker | `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--surface-container-highest`, `--surface-dim`, `--tracker-0` … `--tracker-4`, `--text-title`, `--text-title-sm`, `--radius-xs`, `--radius-lg`, `--shadow-card`, `--frame-line` |
| Work drawer and carousel | `--surface-container-low`, `--surface-container-highest`, `--shadow-card`, `--frame-line`, `--outline-variant`, `--primary`, `--radius-lg`, `--text-xs` … `--text-lg`, `--text-title`, `--text-title-sm`, `--wd-panel-inset`, `--wd-nav-inset`, `--wd-nav-height`, `--wd-nav-content-gap` |
