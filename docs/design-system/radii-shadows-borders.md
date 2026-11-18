# Radii, shadows and borders — as built (2026-11-18)

## Radius tokens

| Token | Value | Source | Consumers |
| --- | --- | --- | --- |
| `--radius-xs` | `2px` | `src/app/globals.css:776` | tracker cells (`rounded-xs`, `src/components/home/tracker-widget.tsx:45`) |
| `--radius-sm` | `0.25rem` (4px) | `src/app/globals.css:777` | small chips; play/dev controls |
| `--radius-md` | `0.5rem` (8px) | `src/app/globals.css:778` | nav items, glyph, theme menu rows, tooltips, message CTA |
| `--radius-lg` | `0.75rem` (12px) | `src/app/globals.css:779` | cards, nav bar, menus, reader panel, hero, media, ruler card, ring surface |

Radius literals that are not the tokens:

| Value | Where | Source |
| --- | --- | --- |
| `6px` | theme segment, selection pill, shape layer, step tab, replay chip | `src/components/theme/theme-toggle.tsx:571`, `:289`; `src/components/theme/theme-toggle.css:447`; `src/components/work/reader.css:899`, `:923` |
| `4px` | inline code, reader focus radii (rail, margin note) | `src/components/work/reader.css:575`, `:166`, `:680` |
| `3px` | ruler section-tick row | `src/components/work/scroll-ruler.css:90` |
| `2px` | footnote focus radius | `src/components/work/reader.css:741` |
| `1px` | ruler tick and indicator | `src/components/work/scroll-ruler.css:68`, `:132` |
| `999px` | thumb targets, faux-UI pills | `src/components/work/reader.css:235`; `src/components/faux-ui/faux-ui.css:101` |
| `50%` | nav orb, faux-UI circles | `src/components/home/home-nav.tsx:32`; `src/components/faux-ui/faux-ui.css:154` |
| `8px` | card-fade inner box, faux-UI card/dialog | `src/components/home/home-cards.tsx:86`; `src/components/faux-ui/faux-ui.css:62` |
| `12px` | reader panel (written as a literal, not `--radius-lg`) | `src/components/work/reader.css:25` |
| `10px` / `7px` / `5px` / `14px` | faux-UI pieces | `src/components/faux-ui/faux-ui.css:128`, `:192`, `:386`, `:547` |

Nested radii: the ring surface uses `--radius-lg` outside and `calc(var(--radius-lg) - 1px)` for the
fill inside the 1px edge (`src/components/home/ring-hover.css:25-26`). On hover the surface clip is
`inset(1px round var(--ring-inner-radius))`; at rest it is `inset(6px 3.5px round var(--radius-lg))`,
which is the card box (`ring-hover.css:120-122`, `:143-145`). Reduced motion keeps the rest clip and
reveals the ring inside the card (`ring-hover.css:225-250`).

## Shadows

| Token / element | Day / Dawn / Dusk | Night | Source |
| --- | --- | --- | --- |
| `--shadow-card` | `0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04)` | `0 0 0 1px rgb(255 255 255 / 0.08)` | `src/app/globals.css:457-459`, `:697` |
| `shadow-card` utility | `box-shadow: var(--shadow-card)` | same | `src/app/globals.css:737-739` |
| Reader panel, ≥768 | `var(--shadow-card), 0 30px 70px -30px rgb(0 0 0 / 0.45)` | same shadow pair | `src/components/work/reader.css:26-28` |
| Reader panel, closing | `var(--shadow-card)` only, transitioned over `350ms cubic-bezier(0.22, 1, 0.36, 1)` | same | `reader.css:40-48` |
| Ruler hover card | `var(--shadow-card), 0 14px 34px -14px rgb(0 0 0 / 0.5)` | same | `src/components/work/scroll-ruler.css:164-166` |
| Play card (`/play`) | `shadow-card` | same | `src/components/play/play-card.tsx:30` |

The 1px ring inside `--shadow-card` is the card edge; cards and menus carry no border
(`src/app/globals.css:8`). The ring surface sets `background-color: transparent` and keeps the shadow
on the host box (`ring-hover.css:38-47`), and on the featured card the shadow moves to the frame's
`::before` during a carousel step (`src/components/home/carousel/home-carousel.css:645-652`).

Forced colours replaces the shadow, and therefore the edge, with a real border:

| Selector | Replacement | Source |
| --- | --- | --- |
| `.shadow-card` | `1px solid CanvasText` | `src/app/globals.css:748-752` |
| `.ring-host` | `1px solid CanvasText` | `src/components/home/ring-hover.css:56-60` |
| `.wd-reader-panel`, `.wd-reader-action`, `.wd-step-tab`, `.wd-step-replay` | `1px solid CanvasText` | `src/components/work/reader.css:1035-1042` |
| `.wd-ruler-card-inner` | `1px solid CanvasText` | `src/components/work/scroll-ruler.css:223-227` |

## Borders

| Use | Value | Source |
| --- | --- | --- |
| Vertical frame lines | `1px` wide, `bg-frame-line`, `min-[1440px]` | `src/components/home/home-layout.tsx:108-117` |
| Horizontal frame lines | `1px` high, `bg-frame-line`, `-inset-x-8`, `min-[1440px]` | `home-layout.tsx:122-133` |
| Reader blockquote | `2px solid var(--outline-variant)` inline start | `src/components/work/reader.css:565` |
| Reader `hr` | `border-top: 1px solid var(--outline-variant)` | `reader.css:599-603` |
| Reader table cells | `1px solid var(--outline-variant)` top; last row also bottom | `reader.css:828-835`, `:856-859` |
| Notes block | `1px solid var(--outline-variant)` top | `reader.css:760-764` |
| Next-link block | `1px solid var(--outline-variant)` top | `reader.css:981-985` |
| Nav divider | `1px` wide, `20px` high, `bg-outline-variant` | `src/components/home/nav-items.tsx:539` |
| Ring edge | 1px `--frame-line` painted as a background, held one pixel outside the fill | `src/components/home/ring-hover.css:62-85`, `:119-122` |
| Spotlight strips | 1px frame-line hosts, pool clipped to the strip | `src/components/home/frame-line-spotlight.css:25-29` |

### Focus outlines

All focus rings are `2px solid var(--primary)`; the offset is the only value that varies.

| Element | Offset | Radius before the ring | Source |
| --- | --- | --- | --- |
| Ring hosts (cards, nav bar) | `2px` | host's own | `src/components/home/ring-hover.css:213-216` |
| Nav labels and glyph | `0` | `--radius-md` | `src/components/home/nav-items.tsx:27-28`, `:39-40`; `home-nav.tsx:41-42` |
| Reader rail links | `2px` | `4px` | `src/components/work/reader.css:164-169` |
| Reader thumb buttons | `2px` | `999px` (unchanged) | `reader.css:176-179` |
| Margin notes / footnote refs | `2px` | `4px` / `2px` | `reader.css:678-683`, `:739-744` |
| Step chips and replay | `2px` | `6px` | `reader.css:914-917`, `:948-951` |
| Next link | `3px` | `2px` | `reader.css:1023-1027` |
| Ruler section tick | `1px` | row's own | `src/components/work/scroll-ruler.css:115-118` |
| Message CTA | `2px` | `--radius-md` | `src/components/system/message-screen.tsx:11` |

## Notes

- `--radius-sm` (4px) has no consumer in shipped component CSS outside the play/dev surfaces; the
  reader writes `4px` directly.
- The reader panel writes `12px` directly where the rest of the app uses `--radius-lg`
  (`reader.css:25`).
- The ring's 1px edge is not a border: it is `background-color: var(--ring-line)` on an oversized
  frame, clipped to leave exactly 1px visible (`ring-hover.css:66-80`).
