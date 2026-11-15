# Work Drawer (Header + Margin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the case-study reader at `/work/[slug]`. It opens from the featured homepage card with an Expand morph, uses the Header nav with a progressive blur and the Margin reading layout, and gets close-at-hand ways back, back-to-top, and resize-safe layout.

**Architecture:**
- **Rendering.** The homepage stays mounted while an intercepting route (`@modal/(.)work/[slug]`) renders one shared `<Reader>` on top of it. A direct load renders the same `<Reader>` from `app/work/[slug]/page.tsx`.
- **Morph.** The morph is transform-only FLIP and is measured at open and again at close. Once the morph ends, all geometry is plain CSS, so a resize just reflows.
- **Content.** Content is MDX with frontmatter. The MDX components are the prototype's Margin parts, promoted out of `dev/proto`.

**Tech Stack:**
- Next.js 16.4 App Router
- React 19.3
- `motion/react` 14
- `@next/mdx` (deps already installed)
- vitest 5 with jsdom and @testing-library

**Spec:** `docs/superpowers/specs/2026-11-13-work-drawer-design.md`. Read it first. Section numbers below (§) refer to it.

## Global Constraints

- **Nav parity.** The reader's nav must be pixel-identical to the homepage `HomeNav` at 1440, 1024, 768 and 375 in Day and Night. Pass means 24/24.
- **Motion source.** Motion values come from `docs/design-system/motion.md`:
  - Entrance: `cubic-bezier(0.23, 1, 0.32, 1)`.
  - Exit: ease-in.
  - Reduced motion: opacity only, 120ms ease-out, no transforms.
- **Morph timing:**
  - Open: 480ms, `cubic-bezier(0.32, 0.72, 0, 1)`.
  - Close: 300ms ease-in.
  - Content fade-in: 240ms. Content fade-out: 140ms.
  - Title-flight fade: 180ms ease-out, 50ms delay.
  - "↑ Top" fade: 150ms.
- **Composite-only animation.** Animate `transform` and `opacity` only. Never animate `left`, `top`, `width`, `height` or a blur radius.
- **Banned:** scroll-jacking, scroll-triggered entrances, intro loaders, swipe-to-dismiss.
- **Dev server:** run it with `pnpm dev:log`. Never run piped `pnpm dev`.
- **Gates.** Every task ends green on all of these:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
- **Commit messages.** Every commit has a body: what changed, why, and the root cause where there is one. End it with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Safety.** No pushing, PRs or merges without Dat's OK. Never delete files. The prototype under `src/app/dev/proto/work-drawer/` stays, so copy from it rather than moving out of it.
- **Skills to apply:** emil-design-eng, emil-performance, emil-touch-and-accessibility, animate. Their criteria apply to every UI task.

## Review Focus

| # | Condition | Expected behavior | Test lives in |
|---|---|---|---|
| 1 | Window resized while the reader is open, at 1440→375→1440 and the reverse | Reflows with no overflow. The nav still matches the homepage. Close lands on the card's current rect. | Task 3, `morph.test.ts` (measured at close) |
| 2 | Browser back or Esc pressed during the open morph | The morph stops. The close plays from the current transform, with no jump and no stuck panel. | Task 3, `use-morph.test.tsx` |
| 3 | Direct load or hard refresh of `/work/[slug]` | Full reader, no morph, no backdrop. "← Work" navigates to `/`. | Task 2, `page.test.tsx` |
| 4 | Unknown slug | `notFound()`, not a crash | Task 1, `work.test.ts` |
| 5 | No source card in the DOM (any slug other than the featured one) | Opens with the reduced-motion fade instead of the morph | Task 3, `use-morph.test.tsx` |

---

### Task 1: Case-study content (MDX + loader)

**Files:**

| Action | Path |
|---|---|
| Modify | `next.config.*`: wire `@next/mdx` if not already wired. Check first. |
| Create | `content/work/systems-in-motion.mdx`, `content/work/title-sequence.mdx`, `content/work/type-in-motion.mdx` |
| Create | `src/lib/work.ts` |
| Test | `src/lib/work.test.ts` |

**Frontmatter and placeholder content:**
- Frontmatter: `title`, `subtitle`, `year`, `role`, `summary`, `cover`.
- `cover` is one of `tiles`, `window` or `phone`.
- The **featured** study is `systems-in-motion`, with `cover: tiles`.
- The bodies are placeholder text adapted from `src/app/dev/proto/work-drawer/reader-story.ts`. Each follows concept → system → process → outcome. They use the Task 2 MDX components.

**Interfaces:**
- Produces:
  - `type WorkMeta = { slug: string; title: string; subtitle: string; year: string; role: string; summary: string; cover: 'tiles' | 'window' | 'phone' }`
  - `listWork(): WorkMeta[]`
  - `getWork(slug: string): WorkMeta | null`
  - `FEATURED_SLUG = 'systems-in-motion'`

**Steps:**
- [ ] **Step 1: Write the failing tests** in `work.test.ts`:
  - `listWork()` has length 3, and every item's `cover` is in `['tiles','window','phone']`.
  - `getWork('systems-in-motion')?.cover === 'tiles'`.
  - `getWork('nope') === null`.
- [ ] **Step 2: Run them and confirm they fail.**
  - Run: `pnpm vitest run src/lib/work.test.ts`
  - Expected: FAIL, module not found.
- [ ] **Step 3: Implement `work.ts`.**
  - Read the frontmatter at build time. MDX `export const meta = {...}` is fine, as is `gray-matter` if it's already installed. Don't add deps without need.
  - Write the 3 MDX files.
- [ ] **Step 4: Run the tests and confirm they pass.** Then `pnpm typecheck`.
- [ ] **Step 5: Commit**, e.g. `feat(work): MDX case-study content and loader`.

### Task 2: Shared `<Reader>` (Margin layout, one scroll container) + direct-load page

**Files:**

| Action | Path |
|---|---|
| Create | `src/components/work/reader.tsx`, `src/components/work/reader.css` |
| Create | `src/components/work/parts.tsx`: copied from the proto's `reader-parts.tsx` (`Intro`, `Figure`, `NoteBlock`, `FootnoteLink`, `Footnotes`, `BriefQuote`, `DecisionTable`, `StepFigure`, `ContactSheet`, `NextLink`) |
| Create | `src/components/work/mdx-components.tsx` |
| Create | `src/app/work/[slug]/page.tsx` |
| Test | `src/app/work/[slug]/page.test.tsx` |

**Interfaces:**
- Consumes: Task 1's `getWork` and `listWork`.
- Produces:
  - `Reader({ meta, children, mode }: { meta: WorkMeta; children: ReactNode; mode: 'overlay' | 'page' })`
  - `mdxComponents` for the MDX tags `<Note n>`, `<Figure wide caption>`, `<Brief>`, `<Steps rows>`, `<Hero>`
  - `READER_SCROLL_ID = 'wd-reader-scroll'`
  - `READER_TITLE_ID` (re-exported)

**Structure (§1, §6):**
- `Reader` is a `position: fixed` panel that does its own scrolling: an inner `#wd-reader-scroll` with `overflow-y: auto` and `overscroll-behavior: contain`.
- Panel inset: 16px from 768px up, 0 below.
- The panel is `role="dialog"` with `aria-modal` only when `mode==='overlay'`. Label it with `aria-labelledby={READER_TITLE_ID}`.

**Geometry (§1):**
- Column measure is 550px, as in the proto's `reader.css:26-31`.
- From 1024px up:
  - Margin notes are 170px wide, positioned `left: calc(100% + 20px)`.
  - The left margin holds the rail slot that Task 6 fills.
- Below 1024px, notes flow inline.
- Wide figures (from 768px up):
  - Width: `min(880px, 100cqi - 96px)`.
  - Use **container query units on the scroll container** (`container-type: inline-size`), not `100vw`. This fixes the 16px inset and scrollbar-gutter error noted in §1.
- **No JavaScript-computed pixel geometry anywhere in `Reader`.**

**Hero and page:**
- Hero: Task 7 fills it with the cover scene. Until then, render a neutral `--surface-container` box at 16:9.
- `page.tsx`:
  - Export `generateStaticParams` from `listWork()`.
  - Call `notFound()` for unknown slugs.
  - Render `<Reader mode="page">` with the MDX body.

**Steps:**
- [ ] **Step 1: Write the failing tests** in `page.test.tsx`:
  - Rendering `systems-in-motion` gives a heading with its title and `id=READER_TITLE_ID`.
  - There is **no** `role="dialog"` in page mode.
  - The reader ends with a "Next project" link to `/work/<next slug>`, wrapping around: the last study links to the first. Add `nextWork(slug): WorkMeta` to Task 1's `work.ts`.
  - Calling the page with `slug:'nope'` throws Next's not-found error. Mock `next/navigation`'s `notFound` to throw, and assert that it was called.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the gates.** Then check by eye with `pnpm dev:log` at `/work/systems-in-motion`, at 1440 and 375:
  - the margin notes sit beside the column at 1440 and inline at 375;
  - the 880px figure is centred on the column;
  - nothing scrolls horizontally.
- [ ] **Step 5: Commit**, e.g. `feat(work): shared Margin reader and direct-load page`.

### Task 3: Intercepting route + Expand morph owned by the modal

**Files:**

| Action | Path |
|---|---|
| Modify | `src/app/layout.tsx`: accept and render a `modal` slot after `children` |
| Create | `src/app/@modal/default.tsx`: returns `null` |
| Create | `src/app/@modal/(.)work/[slug]/page.tsx` |
| Create | `src/components/work/morph.ts` (pure math) |
| Create | `src/components/work/use-morph.ts` |
| Create | `src/components/work/expand-shell.tsx` |
| Modify | `src/components/home/home-cards.tsx`: `ProjectCard` becomes a `next/link` `<Link href={`/work/${slug}`} data-work-card={slug}>` |
| Modify | `src/components/home/home-layout.tsx`: pass `slug={FEATURED_SLUG}` and the featured meta's title |
| Test | `src/components/work/morph.test.ts`, `src/components/work/use-morph.test.tsx` |

**`ProjectCard` changes:** keep the `onOpen` path only for the proto. The new `slug` prop switches the card to Link mode. The card's `h1` gets `data-work-card-title`.

**Interfaces:**
- Consumes:
  - Task 2's `Reader` and `READER_TITLE_ID`.
  - The DOM hooks `[data-work-card="<slug>"]` and `[data-work-card-title]`.
- Produces:
  - `type Box = { left: number; top: number; width: number; height: number }`
  - `flipFrom(from: Box, to: Box): { x: number; y: number; scaleX: number; scaleY: number }`. The transform origin is the top left.
  - `findCard(slug: string): { card: Box; title: Box | null } | null`. It reads `getBoundingClientRect` at call time.
  - `useMorph(slug: string, panelRef, titleRef): { phase: 'opening' | 'open' | 'closing'; close: () => Promise<void> }`
  - `ExpandShell({ slug, children })`: renders the backdrop, then `<Reader mode="overlay">`, then the title-flight layer.

**Behaviour:**

| Moment | What happens |
|---|---|
| Open | `findCard(slug)` runs at open. The panel animates from `flipFrom(card, panelRect)` to identity at 480ms, `[0.32,0.72,0,1]`. The content fades in after it (240ms). |
| Title flight | A fixed clone animates **transforms**: `x`, `y` and `scale` from `flipFrom(titleFrom, titleTo)`. Never `left`, `top` or `width`. It fades out over 180ms ease-out with a 50ms delay once the content is visible. |
| Morph end | Clear every inline transform, so the panel is pure CSS. |
| Close | Call `findCard(slug)` **again** to get the current rect, then run the reverse: 300ms ease-in, with the content fading out over 140ms first. |
| Resize during `opening` | Jump the animation to its end (`animation.complete()`), then reflow. Root cause in the proto: `drawer.tsx:67-74`, `drawer-proto.tsx:75,147,179` and `drawer.tsx:402-413,464` each measure once and never listen for resize. **The fix is not a resize listener.** It is having no JavaScript pixel geometry after the morph. |
| Interrupted open | Esc or back during `opening` reverses from the current values. Motion's animate handles this, so don't restart from the card. |
| No card found, or reduced motion | Opacity-only open and close at 120ms ease-out. No title flight. |
| Browser back | The `@modal` slot unmounts. Wrap the slot's content in `AnimatePresence` keyed on the pathname, so the reverse morph runs as the exit. |
| Overlay a11y (§7) | Body scroll lock while open. Focus the title when the open morph ends. Port the proto's focus trap. Return focus to `[data-work-card]` after close. |
| `close()` | Runs the reverse morph, then `router.back()` if `window.history.state` shows an in-app entry, else `router.push('/')`. |

**Steps:**
- [ ] **Step 1: Write the failing tests.**
  - In `morph.test.ts`, test `flipFrom`:
    - `flipFrom({left:100,top:200,width:753,height:416}, {left:16,top:16,width:1408,height:868})` deep-equals `{x:84, y:184, scaleX:753/1408, scaleY:416/868}`.
    - `flipFrom` of a box onto itself gives `{x:0,y:0,scaleX:1,scaleY:1}`.
  - In `use-morph.test.tsx`, test `findCard`:
    - It returns null when no `[data-work-card]` exists.
    - Its two calls read **live** rects: mock `getBoundingClientRect` to return A, then B, and assert that the close used B.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement `morph.ts`, `use-morph.ts` and `expand-shell.tsx`, plus the route and slot files.** Port the morph from the proto's `drawer.tsx:466-571`, applying the changes above.
- [ ] **Step 4: Run the gates.** Then check manually with `pnpm dev:log` on `/`:
  - Click the card: the morph opens and the URL becomes `/work/systems-in-motion`.
  - Esc closes it back into the card.
  - Open at 1440, drag the window to 375 and back, then close: it lands on the card, with no overflow.
  - Hard refresh on `/work/...`: no morph.
- [ ] **Step 5: Commit.** The body must name the root cause of the resize bug, listed above.

### Task 4: Header nav inside the reader + nav close gestures

**Files:**

| Action | Path |
|---|---|
| Modify | `src/components/home/home-nav.tsx` |
| Create | `src/components/work/reader-nav.tsx` |
| Modify | `src/components/work/expand-shell.tsx`, `src/components/work/reader.tsx` |
| Test | `src/components/home/home-nav.test.tsx`, `src/components/work/reader-nav.test.tsx` |

**`HomeNav` changes:**
- The logo becomes `<Link href="/" aria-label="Home">`.
- "Work" becomes `<Link href="/">`.
- Play and About stay as `<span>`.
- **Zero visual change.** Reset the link styles and keep the same classes.

**Interfaces:**
- Produces:
  - `ReaderNav({ onClose }: { onClose: () => void })`. It renders the real `<HomeNav />` at the top of the reader panel and catches clicks on `a[href="/"]` inside it. On a primary click with no modifier keys, it calls `preventDefault()` and then `onClose()`.
  - `useEscToClose(onClose)`

**Placement (§1):**
- The nav's left, width and height match the homepage nav.
- **Derive them in CSS**, using the same `max-width` and `px-4 md:px-8` container as `home-layout.tsx:55`. Measuring would bring back the resize bug.
- Top inset is 8–12px. Tune it until it matches the homepage.
- The close row is removed. The proto's `NavHeaderBar` is not ported.
- In overlay mode, the nav is inside the focus trap.

**Stacking:** content (z 0) → blur (z 1) → nav (z 2).

**Steps:**
- [ ] **Step 1: Write the failing tests.**
  - `home-nav.test.tsx`:
    - There is a link named "Home" with `href="/"`.
    - The "Work" link has `href="/"`.
  - `reader-nav.test.tsx`:
    - Clicking "Work" calls `onClose` once and the default is prevented.
    - Cmd/Ctrl-click does not call `onClose`.
    - Pressing Escape calls `onClose`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the gates.** Then run the **nav parity check**:
  - Viewports: 1440, 1024, 768, 375. Themes: Day, Night.
  - Compare the homepage nav and the reader nav: `getBoundingClientRect` left, width and height, computed `background-color`, `border-radius` and `box-shadow`. The top is allowed to differ.
  - Record a 24-row table in the commit body. All rows must pass.
- [ ] **Step 5: Commit.**

### Task 5: Progressive blur above the nav

**Files:**

| Action | Path |
|---|---|
| Create | `src/components/work/blur-stack.tsx`, `src/components/work/blur-stack.css` |
| Modify | `src/components/work/reader.tsx` |
| Test | `src/components/work/blur-stack.test.tsx` |

**Interfaces:** `BlurStack({ height }: { height: string })`. `height` is a CSS length: the nav's bottom edge, computed in CSS from the nav top inset plus the nav height (64px).

**Spec (§2):**
- **Zone.** An `absolute` layer at the top of the panel, spanning its full width, with `pointer-events: none`.
- **Bands.**
  - 6 bands with `backdrop-filter: blur()` of 1, 2, 4, 8, 16 and 32px. The heaviest band sits at the top.
  - Each band is masked with a `mask-image` linear gradient, so it overlaps its neighbours by one band.
  - These starting values are tuned by eye in Day and Night.
- **Tint.** The top band adds a tint of the panel surface, `color-mix(in oklch, var(--surface-container-low) 60%, transparent)`, fading to 0 at the bottom.
- **Fallback.** Under `@media (prefers-reduced-transparency: reduce)`, or `@supports not (backdrop-filter: blur(1px))`, render one solid gradient from the panel surface to transparent instead of the bands.
- **No animation.** Nothing in this component animates.
- **Stacking.** Don't create a stacking context that clips the nav: no `overflow: hidden` on shared ancestors. Check that the nav's hover capsule and theme tooltips render over the blur.

**Steps:**
- [ ] **Step 1: Write the failing test.** The stack renders 6 band elements with `aria-hidden="true"`.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the gates.** Then check by eye at 1440 and 375, Day and Night:
  - Scrolled text stays visible above and beside the nav, and is visibly blurrier toward the top.
  - Scrolling is free of jank in Chrome. Note in the commit that Safari was not checked if no Safari is available.
  - Re-run the nav parity spot check at 1440 Night.
- [ ] **Step 5: Commit.**

### Task 6: Ways back: "← Work" rail, "↑ Top", mobile buttons

**Files:**

| Action | Path |
|---|---|
| Create | `src/components/work/reader-rail.tsx`, `src/components/work/use-show-top.ts` |
| Modify | `src/components/work/reader.tsx`, `src/components/work/reader.css` |
| Test | `src/components/work/use-show-top.test.tsx`, `src/components/work/reader-rail.test.tsx` |

**Interfaces:**
- Consumes:
  - `onClose`. In overlay mode it comes from `useMorph().close`. In page mode it is undefined, so the plain link navigates.
  - `READER_SCROLL_ID` and `READER_TITLE_ID`.
- Produces:
  - `useShowTop(scrollEl: HTMLElement | null): boolean`. It is true once `scrollTop > clientHeight`, re-checked on `scroll` with a passive listener and rAF throttling.
  - `ReaderRail({ onClose }: { onClose?: () => void })`

**Spec (§3):**
- **From 1024px up.** The rail lives in the left margin:
  - "← Work" is a `<Link href="/">`. When `onClose` is set, it calls `preventDefault()` and `onClose()`. It is `position: sticky`, just under the blur zone, aligned to the title's first line. It uses the margin-note type style, with no surface.
  - "↑ Top" is sticky near the viewport bottom. It fades over 150ms using `opacity` plus `visibility`, and has `inert` while hidden.
  - Clicking "↑ Top" runs `scrollEl.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })`, then focuses `#READER_TITLE_ID` with `preventScroll`.
- **Below 1024px:**
  - Two 44×44 round icon buttons, fixed bottom-left ("← Work") and bottom-right ("↑ Top").
  - Each has an `aria-label`.
  - `bottom: max(16px, env(safe-area-inset-bottom))`.
  - Same visibility rule for "↑ Top".
  - They use the card shadow, not a border (the cards-shadow-not-stroke rule).

**Steps:**
- [ ] **Step 1: Write the failing tests.**
  - `useShowTop`:
    - false at `scrollTop=0`;
    - true after setting `scrollTop = clientHeight + 1` and dispatching `scroll`.
  - The rail:
    - With `onClose`, clicking "← Work" calls it.
    - "↑ Top" calls `scrollTo` with `behavior:'smooth'`, or `'auto'` when `matchMedia('(prefers-reduced-motion: reduce)')` matches.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the gates.** Then check by eye at 1440 and 375:
  - "← Work" is reachable without scrolling up.
  - "↑ Top" appears after one screen.
  - Every way back closes with the reverse morph on soft navigation and navigates to `/` on a direct load. That is 5 ways on desktop and 4 on mobile: "← Work", Esc, browser back, logo and "Work". (Mobile has no Esc.)
- [ ] **Step 5: Commit.**

### Task 7: Faux-UI cover scenes

**Files:**

| Action | Path |
|---|---|
| Create | `src/components/work/cover.tsx` |
| Modify | `src/components/home/home-cards.tsx` (the featured card's art slot), `src/components/work/reader.tsx` (the hero) |
| Test | `src/components/work/cover.test.tsx` |

**Precondition:** Dat has approved merging `drxaviert/faux-ui` into `main`, and `main` has been merged into this branch. **Ask the lead before merging anything.** If the precondition isn't met, build `Cover` with the neutral fallback only and stop. Report it as blocked on the merge.

**Interfaces:** `Cover({ scene }: { scene: WorkMeta['cover'] })`. It maps `tiles`, `window` and `phone` to the faux-UI branch's scene components, and renders the neutral surface for anything it can't resolve.

**Behaviour:**
- Scenes loop. Their loops pause offscreen and in hidden tabs, which is handled by the faux-UI code. Show the Still frame under reduced motion.
- The featured card renders `<Cover scene="tiles">`.
- The reader hero renders the same scene, so the picture carries across the morph.

**Steps:**
- [ ] **Step 1: Write the failing test.**
  - `scene="tiles"` renders the Tiles scene's root, identified by its test id or role.
  - An unknown scene renders the neutral fallback.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.**

### Task 8: Final verification + motion hand-off

- [ ] **Step 1: Run the full gates.** All must be clean: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] **Step 2: Nav parity, 24/24.** Use the Task 4 method across all 4 viewports and both themes. Attach the table.
- [ ] **Step 3: Resize matrix.**
  - Open at 1440 → drag to 375 → back to 1440 → close.
  - Open at 375 → 1440 → close.
  - Esc during the open morph.
  - Browser back during the open morph.
  - Report pass or fail for each.
- [ ] **Step 4: Prepare the motion entries for Dat's approval.** Draft them, do not write them to `motion.md`. Cover:
  - the expand morph;
  - the title flight (transform-based);
  - the content fade;
  - the "↑ Top" fade;
  - the reduced-motion paths.

  Include every value in Global Constraints. Logging them is a separate step after Dat approves.
