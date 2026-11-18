# Typography — as built (2026-11-18)

## Families

| Family | Definition | Where | Consumers |
| --- | --- | --- | --- |
| Work Sans | `next/font/google`, subset `latin`, styles `normal` + `italic`, `display: "swap"`, variable `--font-work-sans` | `src/app/layout.tsx:10-15` | the whole app; `<html class={workSans.variable}>` at `:57` |
| Sans stack | `var(--font-work-sans), ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` | `src/app/globals.css:732-734` (`--font-sans` in `@theme inline`) | default via Tailwind's `font-sans`; `body` inherits |
| Mono stack | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | `src/components/work/reader.css:578`, `:798` | `.wd-code`, `.wd-pre`, `.wd-brief pre` |

`body` sets `font-synthesis: none` and `-webkit-font-smoothing: antialiased` /
`-moz-osx-font-smoothing: grayscale` (`src/app/globals.css:785-791`).

## Scale

Defined in `@theme` (`src/app/globals.css:754-780`); Tailwind's `text-*` utilities read these names.

| Token | Value | Line-height | Letter-spacing | Source | Consumers |
| --- | --- | --- | --- | --- | --- |
| `--text-xs` | `0.75rem` (12px) | inherited / set per use | — | `src/app/globals.css:757` | reader rail, captions, margin notes, table head, tooltips (`text-xs`), ruler card, step chips |
| `--text-sm` | `0.875rem` (14px) | inherited | — | `:758` | reader code, pre, table |
| `--text-base` | `1rem` (16px) | inherited | — | `:759` | reader body, intro subtitle, nav labels (`text-base`), theme menu rows, thumb buttons, next-link |
| `--text-lg` | `1.125rem` (18px) | inherited | — | `:760` | reader `h2` |
| `--text-xl` | `1.25rem` (20px) | inherited | — | `:761` | no shipped consumer found |
| `--text-2xl` | `1.5rem` (24px) | inherited | — | `:762` | dev pages only |
| `--text-3xl` | `1.875rem` (30px) | inherited | — | `:763` | no shipped consumer found |
| `--text-4xl` | `2.25rem` (36px) | inherited | — | `:764` | no shipped consumer found |
| `--text-title` | `2.5rem` (40px) | `1.1` | `-0.01em` | `:769-771` | featured card and carousel title at `md`+, message-screen `h1` at `md`+ |
| `--text-title-sm` | `2rem` (32px) | `1.1` | `-0.01em` | `:772-774` | the same titles below `md` (375 reference) |

Display steps are documented in place as Figma 40/44 at ≥768 and 32/35.2 at 375
(`src/app/globals.css:766-768`): the token stores unitless `1.1`, so 40 × 1.1 = 44 and 32 × 1.1 = 35.2.

## Weights in use

| Weight | Where | Source |
| --- | --- | --- |
| 400 (default) | body copy, nav labels' inherited weight is overridden, most reader text | `src/app/globals.css:782-792` |
| 500 | nav labels, theme menu rows, reader kicker, table head, tooltips (`font-medium`) | `src/components/home/nav-items.tsx:26`, `src/components/theme/theme-toggle.tsx:1589`, `src/components/work/reader.css:449`, `:840` |
| 600 | featured/carousel card title, reader `h2`, reader `strong`, ruler card title, message-screen `h1` (`font-semibold`) | `src/components/home/home-cards.tsx:92`, `src/components/work/reader.css:509`, `:591`, `src/components/work/scroll-ruler.css:183` |

No 700 weight is used in shipped CSS or TSX.

## Line-heights

| Value | Where | Source |
| --- | --- | --- |
| `1.1` | title tokens | `src/app/globals.css:770`, `:773` |
| `5` (= `1.25rem` on `text-base`) | nav labels, theme menu rows (`leading-5`) | `src/components/home/nav-items.tsx:26`; `src/components/theme/theme-toggle.tsx:1589` |
| `1` | reader thumb buttons | `src/components/work/reader.css:239` |
| `1.15` | faux-UI headline | `src/components/faux-ui/faux-ui.css:523` |
| `1.3` | reader `h2`, faux-UI small line | `src/components/work/reader.css:508`; `src/components/faux-ui/faux-ui.css:91` |
| `1.35` | ruler card title | `src/components/work/scroll-ruler.css:184` |
| `1.4` | reader next-link | `src/components/work/reader.css:995` |
| `1.42` | rail, captions, margin notes, backlinks, notes list | `src/components/work/reader.css:114`, `:142`, `:625`, `:669`, `:776` |
| `1.5` | intro meta, reader table, ruler card body | `src/components/work/reader.css:483`, `:819`; `src/components/work/scroll-ruler.css:193` |
| `1.55` | reader paragraphs, subtitle, lists | `src/components/work/reader.css:474`, `:499`, `:541` |
| `1.6` | reader `pre` | `src/components/work/reader.css:800` |
| `leading-relaxed` (1.625) | message-screen body | `src/components/system/message-screen.tsx:45` |
| `0` | footnote reference (superscript) | `src/components/work/reader.css:706` |

All leading is unitless except `leading-5`, so a size change and its line can move independently.

## Letter-spacing

| Value | Where | Source |
| --- | --- | --- |
| `-0.01em` | `--text-title`, `--text-title-sm` | `src/app/globals.css:771`, `:774` |
| `0.09em` | reader kicker (`.wd-kicker`), uppercase | `src/components/work/reader.css:450` |
| `0.08em` | message-screen kicker (`tracking-[0.08em]`), uppercase | `src/components/system/message-screen.tsx:39` |
| `0.06em` | reader table head, uppercase | `src/components/work/reader.css:841` |
| `-0.1px` | faux-UI 12–13px labels | `src/components/faux-ui/faux-ui.css:195`, `:256`, `:298`, `:621`, `:925` |
| `-0.2px` | faux-UI 15px label | `src/components/faux-ui/faux-ui.css:492` |
| `-0.6px` | faux-UI 26px headline | `src/components/faux-ui/faux-ui.css:524` |

## Reader role map

Sizes are tokens; leading is the literal listed.

| Role | Size | Leading | Other | Source |
| --- | --- | --- | --- | --- |
| Kicker | `--text-xs` 12px | — | weight 500, `0.09em`, uppercase | `src/components/work/reader.css:445-452` |
| Title | `--text-title-sm` / `md:--text-title` | token `1.1` | `text-balance` | `src/components/work/parts.tsx:68` |
| Subtitle | `--text-base` 16px | `1.55` | `text-wrap: pretty` | `src/components/work/reader.css:470-477` |
| Meta | `--text-xs` 12px | `1.5` | — | `:479-484` |
| Body | `--text-base` 16px | `1.55` | `max-width: 68ch`, `text-wrap: pretty` | `:492-502` |
| `h2` | `--text-lg` 18px | `1.3` | weight 600, `text-wrap: balance` | `:504-511` |
| Lists | `--text-base` 16px | `1.55` | `max-width: 68ch`, `padding-inline-start: 1.35em` | `:534-544` |
| Quote | inherits body | — | `padding-inline-start: 16px`, 2px inline border | `:561-567` |
| Inline code | `--text-sm` 14px | — | mono stack, `padding: 1px 4px` | `:573-581` |
| `pre` | `--text-sm` 14px | `1.6` | mono stack, `padding: 16px` | `:790-802` |
| Table | `--text-sm` 14px | `1.5` | `tabular-nums` | `:815-821` |
| Table head | `--text-xs` 12px | — | weight 500, `0.06em`, uppercase | `:837-843` |
| Caption / margin note | `--text-xs` 12px | `1.42` | — | `:621-627`, `:666-672` |
| Rail | `--text-xs` 12px | `1.42` | — | `:109-116` |
| Step chip | `--text-xs` 12px | — | `tabular-nums` | `:894-907` |
| Ruler card | `--text-xs` 12px | `1.35` title / `1.5` body | title weight 600 | `src/components/work/scroll-ruler.css:179-196` |

## Nav and controls

| Element | Type | Source |
| --- | --- | --- |
| Nav label | `text-base` (16px) / `leading-5` / `font-medium` (500) | `src/components/home/nav-items.tsx:24-29` |
| Nav tooltip / segment tooltip | `text-xs` (12px) | `src/components/home/nav-items.tsx:561`; `src/components/theme/theme-toggle.tsx:785` |
| Theme menu row | `text-base` / `leading-5` / `font-medium` | `src/components/theme/theme-toggle.tsx:1589`, `:1618` |
| Message-screen CTA | `text-base` / `font-medium` | `src/components/system/message-screen.tsx:11` |
| Message-screen body | `text-base` / `leading-relaxed` | `src/components/system/message-screen.tsx:45` |

## Faux-UI canvas type

The work-card scene is drawn on a fixed 753 × 416 canvas and scaled as one image
(`src/components/faux-ui/faux-ui.css:53-65`), so its sizes are **canvas px**, not rem tokens: 10, 11, 12,
13, 15 and 26px, with `-0.1px` / `-0.2px` / `-0.6px` tracking and one `0.06em` uppercase label
(`:90`, `:194`, `:254`, `:296`, `:490`, `:521`, `:619`, `:923`, `:930`, `:941`, `:963`).

## Notes

- 12px is the reader's floor: every readable and interactive element resolves to `--text-xs` or above
  (`tokens.md`, "Type").
- `text-wrap: pretty` is used on body, subtitle and margin notes; `text-wrap: balance` on `h2` and card
  titles.
- The message-screen kicker uses `0.08em`, not the reader's `0.09em`.
