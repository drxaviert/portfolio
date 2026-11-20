# Work index: Mobbin research (2026-11-20)
Collection "Portfolio – work index" (10 saved, private): https://mobbin.com/collections/2da588c4-bda3-469f-8bd1-1243ea2efeeb/mobile/screens
Note: Mobbin returns images inline, so ~40 previews were seen at thumbnail size; none opened closely or exported. Linear/Raycast/Read.cv/Family/Arc/Framer did not surface; Vercel/Clay/Speakeasy stood in. Mobbin's ids (sections: /sites/sections/<id>).

| App | Screen | Link id | Pattern | Steal |
|---|---|---|---|---|
| Instrument | Work index hero | sections/05811dd7-a07a-41ae-9fa7-192b8eede1b1 | statement + filter chips + Stack/Grid switch + 2-up | Mono caps "FILTER:" chips left, "DISPLAY:" toggle right; 1 big feature + 1 small |
| Speakeasy | Customer Showcase | sections/2afc1db3-8263-4449-86c2-de69a202e528 | featured tile + 2-col grid, category chips | Featured spans 2 rows; tiny tag chip above title; one-line blurb |
| Granola | Blog index | sections/9791a337-ced6-4cbb-8a15-200eab245253 | type-only timeline list, chips | Title as the row, tiny meta (author, date) under; no images |
| Greptile | All Posts | sections/e09ffa72-0fab-4bd7-9f85-28059bc08467 | left filter rail with counts + hairline rows | date . author column, bold title, 1-line grey blurb; "[22]" counts |
| Vercel | Blog | sections/aad4f43d-3468-4c3f-9864-7fcb35b9a63a | type-only tinted cards, pill chips | Large title top, date + category over it, blurb pinned to bottom; no cover needed |
| Clay | Case studies | sections/66ffa87c-0bf5-47fe-acd4-2018636364a1 | 4-up cover row, serif name + date | Quiet: cover, one name, one date; "See all" top right |
| Profound | Blog grid | sections/a4ccf8cc-51b4-4576-8265-5ca990936488 | 2-col hairline-divided cells, text only | Meta row: date left, category right; grid by dividers not cards |
| Analogue Agency | Success cases | sections/c27f50ff-dd09-41f9-afc8-598c3ccae77a | giant heading + full-bleed case | "Success cases / See all" two-tone heading; one full-width cover per case |
| Canny | Changelog | screens/7cde0c8b-5a1f-447e-ad5c-4fe0fef9f807 | left date column, right title + tag, expand | Date gutter + coloured tag word + expand +/- |
| Quartz | Latest Stories | screens/85fd70bd-a784-4895-b2f7-2492a256a51c | thumb + headline rows | Small 4:3 thumb left, headline right, hairline between |

## Directions
**A. Refined (safe)** keeps cover grid. Refs: Clay, Vercel, Profound.
- Grid 1 col <640, 2 col 640-960, 3 col above (drawer max 1184); keep 4:3 cover.
- Meta under cover: title 16-18px/600, subtitle 14px muted, then one mono-ish 12px row "2025 . Role . Tag" (Profound meta row).
- Add pill chips above (All / tag) 12px, active filled; view toggle stays as a segmented control (Instrument).
- Hover: cover scale 1.02 + shadow lift (existing soft shadow), title gets arrow nudge 4px. No border.

**B. Restructured (moderate)** featured + list. Refs: Speakeasy, Greptile, Quartz, Canny.
- >=960: first study is a wide featured tile (2/3 width, 16:9 cover, 28px title, blurb); right column = 2-3 compact rows (thumb 4:3 at 96px + title + year).
- <640: featured stacks on top, rest become thumb rows (Quartz); 640-960: featured full width, rows in 2 cols.
- Rows: date gutter left (Canny), title, role, tag word. Counts in chips "All 5" (Greptile).
- Hover: row bg wash (surface-variant), thumb brightens; featured cover subtle parallax 4px.

**C. Expressive / editorial (bold)** type-led index. Refs: Instrument, Analogue, Granola, Greptile.
- Huge heading ("Work" ~64-96px, weight 500, tight tracking; two-tone "Work / 2022-26" like Analogue) over a full-width numbered list.
- Each row: 01 index (mono 12px), title 32-48px, role + year right-aligned; hairline dividers only.
- Hover: row titles dim siblings to 40% opacity, cover preview follows cursor (or fixed in gutter, 4:3, 8px radius), swapping with a 150ms crossfade.
- <640: 24-28px titles, no hover; cover thumb inline 64px. Chips replaced by sort toggle (Year / Role).

## Clashes
- Instrument/Analogue use serif or condensed display fonts: stay in Work Sans (weight + tracking carry the hierarchy).
- Speakeasy, Fibery, FLORA cards use borders: replace with shadow or hairline-free tint (Vercel tinted cells).
- Direction C and chips lose value at 3-6 items; featured + list (B) and numbered list (C) work with few; counts/filters in A/B are near-pointless under ~5 studies, keep chips optional.
- Analogue full-bleed phone mockups and Retool coloured cards clash with the 4 time-of-day themes; use theme tokens only.
- Cursor-follow preview (C) is hover-only: needs a touch fallback; must respect reduced motion.
