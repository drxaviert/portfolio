# Work drawer: case-study reader design

Date: 2026-11-13 · Status: approved by Dat 2026-11-13 · Worktree: `work-drawer`

## Intent

Dat is a motion designer looking for a design-engineer role. The portfolio needs a case-study reader that opens from the homepage's featured Work card. The reader should feel calm and crafted, in the restrained style of Emil Kowalski and Rauno. Each case study will later get an interactive web version with Ciechanowski-style parameter sliders. The reader must leave room for that without being built around it now.

Dat compared nine combinations in the prototype at `/dev/proto/work-drawer` and chose:

- **Setup: Featured.** The reader opens from the single featured card on the homepage.
- **Drawer: Expand.** The card morphs into the reader, and the title flies with it.
- **Nav: Header.** The homepage nav sits at the top of the reader. It must look pixel-identical to the homepage nav.
- **Content: Margin.** A narrow reading column with notes and captions in the margin and 880px media breakouts.

Why, in Dat's words: he likes the nav as a header in this setup. The margin layout gives him "liberty with my content", meaning each case study can mix narrow text, wide media and side notes as it needs.

## Goals

1. Header nav with a **progressive blur** above it. Content scrolls up behind and around the nav and stays visible, blurring more heavily toward the top edge. Today it is cut off hard at the nav's bottom edge.
2. **A way back that is close at hand.** The close button in its own row at the top right is too far from where the reader is looking. Replace it.
3. **Back to top.**
4. **The reader survives a window resize.** Today, resizing while the drawer is open breaks the layout.
5. Promote the chosen combination from the prototype to the real route, `/work/[slug]`, with MDX content and placeholder case studies.

## Non-goals

- Real case-study content. None exists yet, so this uses placeholders shaped like a motion-graphics case study (see `docs/workflows/real-work-intake.md` on the main checkout).
- The interactive slider versions. The margin is reserved as their future home, but nothing is built for them now.
- The faux-UI placeholder scenes for the featured card. A separate lead owns that job.
- The Sheet and Side drawers, the Stack setup, and the Stay and Float nav placements. They stay in the prototype for reference only and do not ship.

## Anti-goals

These would make the work a failure even if it functions:

- Scroll-jacking, intro loaders, scroll-triggered entrance animations or swipe-to-dismiss.
- A nav that differs from the homepage nav by even a pixel in its own geometry or styling.
- Chrome that competes with the content: no loud floating buttons on desktop, and no extra header rows.

## Constraints

- Stack: Next.js App Router and `motion/react`, which the prototype already uses.
- Motion follows `docs/design-system/motion.md`:
  - entrances use `cubic-bezier(0.23, 1, 0.32, 1)`;
  - exits use ease-in;
  - with reduced motion, transitions are opacity-only at 120ms ease-out.
- Nav parity is re-checked at 1440, 1024, 768 and 375, in Day and Night. Pass means 24/24 against the homepage.
- Run the dev server with `pnpm dev:log`, never with piped `pnpm dev`.

## Approaches considered

### Progressive blur

| Approach | Trade-off | Verdict |
|---|---|---|
| **Stacked blur bands** | 5–6 `backdrop-filter` layers. Each one doubles the blur of the layer below and is masked with `mask-image` gradients so the bands overlap. This is the only approach that reads as smoothly increasing blur. It costs some compositing, so keep the stack small. | **Chosen by Dat** |
| One blur layer with a mask fade | Cheaper, but there is no build-up. The layer reads as one smudged band. | Rejected |
| Gradient scrim, no blur | Cheapest, but the content fades out instead of staying visible and blurred. | Rejected |

### Way back to the homepage

| Approach | Trade-off | Verdict |
|---|---|---|
| **Sticky "← Work" link in the left margin, plus Esc, browser back, and the nav's logo and "Work" item** | Sits next to the reading column, so it is always a short reach. Reuses chrome that already exists. | **Chosen** |
| Keep the top-right close button | Too far from the reading column. This is the problem Dat raised. | Rejected |
| Swipe or pull down to dismiss | Fights normal scrolling on long pages. Reads as game-like. | Rejected |

## Design

### 1. Layout (Header + Margin)

- **Reader panel:** keeps the prototype's geometry.
  - It fills the viewport, inset 16px on desktop and 0 below 768px.
  - It uses the `--surface-container-low` surface.
- **Header nav:**
  - It is the real `HomeNav`, kept at its measured homepage left, width and height.
  - It sits at the top of the panel. The close row and its 44px offset are removed, so the nav takes the close row's place.
  - The nav's top inset is a builder call (8–12px). It must match visually across viewports.
- **Reading column:** 550px measure.
- **Margin notes and captions:** 170px wide, 20px to the right of the column, at 1024px and up. Below 1024px they flow inline.
- **Wide figures:** 880px, from 768px up. Size them against the reader panel's content box, not `100vw`. The current `100vw` math ignores the 16px inset and the scrollbar gutter.

### 2. Progressive blur above the nav

- **Zone:** from the nav's bottom edge to the top of the panel, across the panel's full width. Content passes behind the nav and stays visible in the gaps above and beside it.
- **Blur build-up:** the blur increases upward, roughly 1 → 2 → 4 → 8 → 16 → 32px. Each band is masked so it overlaps its neighbours. Exact values are a builder call, tuned by eye in Day and Night.
- **Tint:** a light tint of the panel surface toward the top edge, so text under the nav never fights the nav's own labels.
- **Replaces:** the opaque `NavHeaderBar`.
- **Fallbacks:**
  - `prefers-reduced-transparency`, or no `backdrop-filter` support: a solid gradient from the panel surface to transparent, with no blur.
  - The blur must not create a stacking context that clips the nav's hover capsule or tooltips.
- **Performance:** the blur layers are static. Only the content scrolls under them, and nothing animates a blur value. Check scrolling for jank in Chrome and Safari.

### 3. Ways back

**Close gestures.** Every one of these reverses the expand morph, so the reader shrinks back into the card:

- the **"← Work"** link;
- **Esc**;
- the **browser back** button;
- the nav's **logo** and **"Work"** item.

**"← Work"** (1024px and up):

- It sits in the left margin, aligned to the first line of the title.
- It is sticky: when you scroll, it stays just below the blur zone.
- Its type matches the margin notes, quiet with no surface around it.
- It is a real link to `/`, so it works without JavaScript and on a direct load.

**"↑ Top"** (1024px and up):

- It sits in the same left margin, sticky near the bottom of the viewport.
- It fades in after the reader has scrolled one viewport height, and fades out near the top. Use the standard 150ms hover/fade timing.
- It scrolls smoothly to the top, or jumps instantly with reduced motion.
- After it lands, focus moves to the title.

**Below 1024px:**

- "← Work" and "↑ Top" become two small round icon buttons at the bottom of the screen, within thumb reach. "← Work" sits bottom left and "↑ Top" sits bottom right.
- Each has a tap target of at least 44px, an `aria-label` and a tooltip-free label, and respects the iOS safe area.
- "↑ Top" uses the same show and hide rule as on desktop.

**Close row:** removed.

**Direct loads:** a direct load of `/work/[slug]`, or a hard refresh, shows the full reader page with no morph. Closing it navigates to `/`.

### 4. Resize resilience (bug fix)

**Root cause:** the probable cause comes from the prototype review. The builder must confirm it with systematic debugging before fixing it. Geometry is measured once and never updated:

| Where | What is measured once |
|---|---|
| `drawer.tsx:67-74` | `layout` is held in `useState(() => …)` from the window size |
| `drawer-proto.tsx:75,147` | `navOrigin` |
| `drawer.tsx:402-413` | the panel's pixel left, top, width and height |
| `drawer.tsx:464` | `titleTo`, whose effect deps never change |
| `drawer-proto.tsx:179` | the scrollbar gutter |

Nothing listens for resize.

**Required behaviour:**

- **Once the open morph finishes**, the reader is plain CSS layout: fixed inset, with no pixel boxes from JavaScript. It reflows like a normal page at any size. The nav's box is re-measured from the homepage nav, or derived from the same CSS, whenever the window resizes.
- **Close morph:** re-measure the card and title origin rects at the moment you close, not at the moment you opened.
- **Resizing mid-morph:** jump the morph to its end state, then reflow.

**Verification:** open the reader at 1440, drag to 375, then back to 1440, and close. Repeat starting from 375. Check:

- no overflow or overlap;
- the nav still matches the homepage at the new size;
- the close morph lands on the card.

### 5. Motion

These are the current prototype values, kept. Log them to `motion.md` once Dat approves the build.

| Element | Values |
|---|---|
| Expand morph (open) | 480ms, `cubic-bezier(0.32, 0.72, 0, 1)`. Transform only: x, y, scaleX, scaleY from the card rect. |
| Expand morph (close) | 300ms ease-in. |
| Title flight | Same timing as the morph. A separate fixed title travels from the card heading to the reader title. It fades out over 180ms ease-out after a 50ms delay once the content is visible. |
| Reader content | Fades in over 240ms, `cubic-bezier(0.23, 1, 0.32, 1)`, after the morph. Fades out over 140ms on close. |
| Reduced motion | Opacity only, 120ms ease-out, with no title flight. |

**Builder fix:** the title flight currently animates `left`, `top` and `width`. Move it to transforms (FLIP) so it stays on the compositor, matching `docs/design-system/motion.md` and emil-performance. Keep the visual result the same.

New motion:

- the "↑ Top" fade at 150ms;
- smooth scroll to top, which is native `scroll-behavior` or `scrollTo({behavior:'smooth'})` and instant with reduced motion.

### 6. Routing and content

| Area | What happens |
|---|---|
| Card link | The featured card links to `/work/[slug]`. |
| Intercepting route | An intercepting route (`@modal/(.)work/[slug]`) renders the reader over the homepage, with the morph, on soft navigation. |
| Direct loads | `app/work/[slug]/page.tsx` renders the same reader full page on direct loads. |
| Case-study files | Case studies are MDX files, one per slug. Frontmatter holds title, subtitle, year, role, the card summary and the cover. |
| MDX components | MDX components map to the Margin layout's parts: paragraph, `<Note>` (margin note), `<Figure wide caption>`, `<Brief>` (code block), `<Steps>` (the table), and the hero. |
| Placeholder content | 2–3 placeholder case studies, based on the prototype's `reader-story.ts` and shaped like motion work: concept, system, process, outcome. |
| Prototype | Stays at `/dev/proto/work-drawer` for reference and is not linked from the site. |

**Architecture.** These are lead calls, settled after the builder check.

- **Who owns the morph:**
  - The homepage stays mounted under the `@modal` slot, which is how intercepting routes work. The reader in that slot owns the morph.
  - The reader finds its source card through `[data-work-card="<slug>"]` and measures it when it opens and again when it closes.
  - Close gestures play the reverse morph, then call `router.back()`. If there is no history entry, they call `router.push('/')` instead.
  - Browser back unmounts the slot. Run the reverse morph as an `AnimatePresence` exit keyed on the pathname.
- **The nav:**
  - Keep the prototype's approach: the real `HomeNav` is carried into the reader. That approach already passes 24/24 parity.
  - The nav is inside the dialog's focus trap.
  - Order, bottom to top: content, blur layers, nav. Nav tooltips and the hover capsule must not be clipped.
  - In the reader, the logo and "Work" get a close handler. On the homepage they keep their normal behaviour.
- **One scroll container:** the soft-nav reader and the direct-load page render the same `<Reader>`. It is a fixed full-viewport panel that does its own scrolling. That gives the sticky margin items, the blur, the "↑ Top" threshold and the 880px figure sizing a single container to work against. On a direct load the panel simply has no morph and no backdrop.
- **Slugs with no card on the homepage:**
  - Only the featured study has a card. The other placeholder slugs exist to test the MDX components and direct loads.
  - If no source card is found, the reader opens with the reduced-motion fade instead of the morph.
  - The reader has no next or previous links yet.
- **Frontmatter:**
  - `title`, `subtitle`, `year`, `role`, `summary`, and an optional `cover`.
  - `cover` is one of `window`, `phone` or `tiles`, the faux-UI scenes settled on branch `drxaviert/faux-ui` (see `docs/handoffs/2026-11-13-faux-ui-scenes.md` there). Each scene is a Loop that scales to the ProjectCard's 753×416 box and pauses offscreen. Still is used only for reduced motion. The reader renders the same scene as its hero, so the morph carries the picture across. The reader never builds scenes itself.
  - Getting the scenes into this branch: once Dat OKs it, merge `drxaviert/faux-ui` into `main`, then merge `main` into `work-drawer`. Do not copy files across. If faux-UI hasn't merged when the build starts, the hero uses a neutral surface until it lands.
  - The three placeholder studies use one scene each. **The featured card uses `tiles`** (Dat, 2026-11-13).

### 7. Accessibility

- The open reader is a dialog: `role="dialog"`, `aria-modal`, labelled by the title.
- Focus moves to the title when the reader opens and returns to the card when it closes. The focus trap stays.
- Body scroll lock on soft navigation. A direct load scrolls normally.
- Every way back is keyboard reachable. Esc works from anywhere in the reader.

## Left to the builder

- Exact blur band count and radii, mask stops, tint strength, and the nav's top inset.
- Exact sticky offsets for "← Work" and "↑ Top".
- How the nav box is derived on resize: re-measuring versus shared CSS. Either is fine if nav parity still passes.
- MDX tooling (`@next/mdx` or `next-mdx-remote`), whichever fits the App Router with the least config.
- The order of work (lead call): routes and morph ownership first, so fixes land on the real structure and not the prototype. Then resize fix → blur → ways back → MDX placeholders.

## Acceptance

- Nav parity passes 24/24: 1440, 1024, 768 and 375, in Day and Night, Header mode.
- The blur zone is visibly progressive in both themes. The reduced-transparency fallback is a solid fade. Scrolling has no jank in Chrome or Safari.
- Every way back, five on desktop and four on mobile, closes with the reverse morph on soft navigation and navigates home on a direct load.
- The resize checks in section 4 pass.
- `pnpm build`, lint and typecheck are clean. Commits have a body explaining what changed, why and, where there is one, the root cause.
