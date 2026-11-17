# Typography audit — 2026-11-17

Read-only audit of the shipped type system on `main` (2d6db53); no source files changed. Scope: font
loading, scale and tokens, leading/tracking, measure, wrapping, numerals, truncation, input sizing,
contrast (light, dark, dim tracker ramp), MDX prose, and the home / `/work/[slug]` / nav / toggle
surfaces. `dev/*` is prototype chrome, excluded except where it reaches shipped components. Method: every
production CSS/TSX file read, plus the emitted CSS from `pnpm dev:log` (server stopped after).
Contrast figures are computed from the token hexes; M4/M5 are excluded as fixed.
**1 High, 5 Medium, 6 Low.** No text-contrast failure; the High is a reading-size floor.

## Findings

### T1 · High · `src/components/work/reader.css:360-369`
**Problem.** Case-study body copy is 14px/1.45 — under the 16px floor and under 1.5–1.6 leading, on the
site's primary reading surface. **Fix.** `font-size: 16px; line-height: 1.55`, then re-check the
measure (65ch if 68ch overruns). Visible change: needs Dat.
**Evidence.** `.wd-p { max-width: 68ch; font-size: 14px; line-height: 1.45 }` is the only body rule; no
responsive bump exists anywhere in the file.

### T2 · Medium · `reader.css:94-745`, `scroll-ruler.css:182-196`
**Problem.** The reader runs a raw-px scale (9, 11, 12, 12.5, 13, 14, 15, 16) and bypasses `@theme`;
none of those steps exist in `globals.css` or `docs/design-system/tokens.md`, so doc and code disagree.
**Fix.** Add reader role tokens (`--text-reader-body`, `-label`, `-meta`, `-code`, `-table`) to `@theme`
and `tokens.md`, and point the component rules at them.
**Evidence.** All 19 `font-size` declarations in `reader.css` are px literals; `tokens.md:78-85` lists
only `--text-xs … --text-4xl`, `--text-title`, `--text-title-sm`.

### T3 · Medium · `reader.css:492-497, 518-524, 682-693`
**Problem.** Micro-type falls below the 12px floor, including the site's smallest interactive text: the
9px footnote marker (a link), the 11px back-link and the 11px "Replay". **Fix.** Footnote marker 11px
with a padded hit area (or an `::after` target); back-link and Replay to 12px; keep 11px only for
all-caps kickers. **Evidence.** `.wd-fnref { font-size: 9px }`;
`.wd-backlink`/`.wd-step-replay`/`.wd-kicker` and the table head at 11px.

### T4 · Medium · `reader.css:371-378` (vs `:339-345`, `:360-369`)
**Problem.** Section headings are 15px/600 — 1px above the 14px body and smaller than the 16px
standfirst, so an h2 reads as a bold paragraph and the 44px margin does all the sectioning.
**Fix.** 18px/600 at 1.3 (17px if 18 crowds the 550px measure), keeping `text-wrap: balance`.
**Evidence.** `.wd-h2 { font-size: 15px; line-height: 1.35; font-weight: 600 }`.

### T5 · Medium · `globals.css:400-404, 623-627` + `home/tracker-widget.tsx:72-93`
**Problem.** The two lowest tracker levels are invisible on the card (`tracker/0` 1.07:1 in Day, 1.06:1
in Night; `tracker/1` ~1.15:1), so about half the grid reads as holes rather than data.
**Fix.** Separate level 0 with a `--surface-dim` fill or a 1px inset outline, and lift `tracker/1` one
step — or draw empty cells as outlines and document 0–1 as empty.
**Evidence.** Day `#f3f8fc` on `#ffffff`; Night `#241d1c` on `#191919`; card fill is
`bg-surface-container-low` (`RingLayers`).

### T6 · Medium · `work/mdx-components.tsx:8-21`
**Problem.** Only `h2`, `p`, `a` are mapped; a future `ul/ol/blockquote/code/em/strong/hr` falls through
to UA defaults — 14px inherited colour, browser margins, no token colour, and `em` has no italic face
(see T7). Latent, not visible in the current three bodies.
**Fix.** Add `.wd-ul/.wd-ol/.wd-quote/.wd-code/.wd-strong/.wd-em` to `reader.css` and map the elements.
**Evidence.** `mdxComponents` exports `h2, p, a, Note, Figure, Brief, Steps, Hero`; the studies use only
those.

### T7 · Low · `app/layout.tsx:9-13`, `globals.css:746-754`
**Problem.** Only the roman axis is loaded although Work Sans ships an italic, and `font-synthesis` is
never set, so the first `<em>` in MDX will render a faked slant beside the real face.
**Fix.** `font-synthesis: none` on `body`, then either load `style: ["normal", "italic"]` or map `em` to
500 weight plus a token colour.
**Evidence.** Emitted CSS is `font-weight: 100 900; font-style: normal` only; `font-synthesis` appears
nowhere in `src/`.

### T8 · Low · `globals.css:732-738`
**Problem.** Display leading and tracking are absolute (`2.75rem`, `2.2rem`, `-0.4px`), so tracking
tightens as the size drops: -0.01em at 40px but -0.0125em at 32px — the opposite of the rule.
**Fix.** `--text-title--line-height: 1.1`, `--text-title-sm--line-height: 1.1`, both
`--letter-spacing: -0.01em`. **Evidence.** Emitted
`line-height: var(--tw-leading, var(--text-title--line-height))`; `tokens.md` documents "-0.4px".

### T9 · Low · `globals.css` base layer (`:746-754`)
**Problem.** There is no `::selection` rule, so selection is UA blue against all four phase palettes; in
Night it is the one surface outside the system. **Fix.** Token-paired `::selection` in `@layer base`.
**Evidence.** `grep ::selection src/` returns nothing.

### T10 · Low · `content/work/type-in-motion.mdx:3`
**Problem.** Prose uses typewriter punctuation — the straight apostrophe in "arm's length" — and no em
dashes or curly quotes across the three studies. **Fix.** U+2019 and U+201C-201D in copy (inside the
latin subset's `U+2000-206F`, so Work Sans renders them) and em dashes for asides.
**Evidence.** No non-ASCII at all in `content/work/*.mdx`; one `[A-Za-z]'[A-Za-z]` match, line 3.

### T11 · Low · `nav/nav-dock.css:72-100`, `theme/theme-toggle.tsx:781-789`
**Problem.** Only the reader dock right-aligns the last mode segment's tooltip. On the home dock the
~150px "Auto · follows your clock" label is centred on a 34px segment whose centre is ~35px from the
bar's edge, so ~40px hangs outside it — and at 768–1279px past the viewport edge (clipped, or adding
horizontal overflow). Keyboard focus shows it too.
**Fix.** Hoist `[data-mode-track] .segment:last-child .segment-tooltip { left: auto; right: 0 }` out of
the `[data-nav-state="reader"]` scope.
**Evidence.** Override scoped at `nav-dock.css:93-100`; base tooltip is
`left-1/2 -translate-x-1/2 whitespace-nowrap`.

### T12 · Low · `home/carousel/home-carousel.css:134-138`, `home-carousel.tsx:309-314`
**Problem.** No `overflow-wrap` guard exists anywhere in `src/`, and a card title is absolutely
positioned in `.car-clip` (`overflow: hidden`) with no clamp or ellipsis, so a long unbroken title is
hard-cut at the card edge. **Fix.** `overflow-wrap: anywhere` on `.car-title` and `.wd-intro-title`,
plus `-webkit-line-clamp: 3` on the card title.
**Evidence.** `.car-clip { overflow: hidden }`; the slide's `aria-label` and the study page carry the
full title, so no information is lost today.

## Checked and fine

- **Font loading.** Work Sans variable woff2, 100–900, `display: swap`, latin subset via
  `--font-work-sans`; emitted `unicode-range` covers `U+2000-206F` (quotes, dashes, ellipsis), `U+00B7`
  and `U+2191/2193`. The absent `U+2192` no longer matters: arrows are SVG (`reader-rail.tsx:20-41`,
  `parts.tsx:388-399`).
- **Fallback metrics.** next/font emits `Work Sans Fallback` = `local(Arial)` with
  `size-adjust: 111.93%`, `ascent-override: 83.09%`, `descent-override: 21.71%` — no reflow on swap
  (read from emitted CSS, not assumed).
- **Root wiring.** `lang="en"`; `@theme --font-sans` feeds `--default-font-family`, so `html` resolves
  to `"Work Sans", "Work Sans Fallback"`; smoothing declared once on `body`.
- **Contrast.** `--on-surface-variant` 8.6:1 in Day, 8.3:1 in Night (4.5 needed); `text-primary` and
  `text-secondary` are never used as text, so bright phase accents never become copy; tooltips are
  `on-surface` on `surface` in both modes.
- **Measure and wrap.** Column capped at 68ch (≈68 characters at 14px, inside 45–75);
  `text-wrap: balance` on every display heading (`home-cards.tsx:89`, `home-carousel.tsx:309`,
  `parts.tsx:72`), `pretty` on standfirst and body (`reader.css:344,368`).
- **Numerals and links.** `tabular-nums` on footnote numbers, step chips and dev readouts; underlines
  use `from-font` thickness + 2px offset and a token colour, hover to `on-surface`
  (`reader.css:384-394, 768-772`); casing is CSS `text-transform` + `0.06–0.09em` tracking, never typed.
- **Inputs.** Nothing shipped renders an input; `?tune=1` controls are 16px (M5 intact), so no iOS
  focus-zoom path remains. The ruler preview's 3-line clamp is backed by a clickable tick.
- **Out of scope, noted.** `/dev/system`, `/dev/play-card` and the prototype panels keep a 10–15px px
  scale; faux-UI labels are 10–12px but `aria-hidden` decoration and never ship.
