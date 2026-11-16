# Reader Scroll Ruler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dense tick ruler at the right edge of the study reader that marks the current scroll position and every `##` section, with hover labels and click-to-jump, built from the rendered headings of whatever study is open.

**Architecture:** One client component (`ScrollRuler`) rendered as a sibling of `#wd-reader-scroll` inside `.wd-reader-panel`. It measures the live DOM once per layout change, derives a fixed tick grid plus a section→tick assignment from a pure model module, writes the scroll progress into one CSS custom property per frame (transform only), and scrolls the container on click. Heading ids are generated at measure time, so no per-study config exists anywhere.

**Tech Stack:** React 19 client component, CSS custom properties, `ResizeObserver`, `MutationObserver`, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-16-reader-scroll-ruler-design.md`

## Global Constraints

- Existing motion is untouched: no retiming of `entrance.css`, `reader.css` transitions, or the morph.
- New motion uses only the repo's tokens (`--duration-short-3`, `--ease-decelerate`, `--duration-long-1` per `docs/design-system/motion.md`); animate `transform` and `opacity` only.
- Colours come from theme tokens (`--on-surface`, `--on-surface-variant`, `--outline`, `--outline-variant`, `--primary`); no hex.
- No hover-only information on touch: the ruler is hidden under `(hover: none)` and below 1024px.
- Focus ring on section links, `aria-label` on each link, reduced motion makes the jump instant (`behavior: auto`).
- Tick count 17 by default, grows to one tick per section, nearest-free-tick placement on collision.

## File Structure

- Create `src/components/work/ruler-model.ts` — pure math and text helpers: slugify + dedupe, tick count, section→tick placement, nearest section, progress clamp. No DOM.
- Create `src/components/work/ruler-model.test.ts` — the fixtures the spec asks for (0, 1, 4, 12 sections) at the model level.
- Create `src/components/work/scroll-ruler.tsx` — measurement, scroll tracking, pointer/keyboard behaviour, markup.
- Create `src/components/work/scroll-ruler.css` — the ruler's geometry and theme tokens; also the `hidden` states.
- Create `src/components/work/scroll-ruler.test.tsx` — DOM behaviour: rendered ticks, links, click/target math, hover label, short study, 0/1/4/12 headings.
- Modify `src/components/work/reader.tsx` — render `<ScrollRuler studySlug={meta.slug} />` beside the scroll container.
- Modify `src/components/work/entrance.css` — the ruler joins the existing cascade's last group and stays hidden while the content is pending.

## Review Focus

- A study with 0 or 1 `##` heading: progress tick only, no section links (spec).
- A study shorter than one screen: no ruler at all, no tab stops (spec).
- 12 sections: every section gets its own tick with a distinct index, none dropped.
- A heading whose text slugifies to a duplicate of an earlier one: second id is suffixed, both links resolve.
- Reduced motion: the jump is instant, and the label/tick transitions are off.

---

### Task 1: The ruler model

**Files:** Create `src/components/work/ruler-model.ts`, `src/components/work/ruler-model.test.ts`

**Interfaces:**
- `slugifyHeading(text: string): string` — lowercase, strip diacritics, non-alphanumerics → `-`, trim dashes, `"section"` when empty.
- `uniqueHeadingId(text: string, used: Set<string>): string` — slug, then `-2`, `-3`… on collision; adds the result to `used`.
- `rulerTickCount(sectionCount: number): number` — `max(17, sectionCount)`.
- `placeSectionTicks(progress: number[], tickCount: number): number[]` — per section, the nearest free index to `round(clamp01(p) * (tickCount - 1))`, searching outward.
- `nearestSection(progress: number[], p: number): number` — index of the closest progress, `-1` when empty.
- `clamp01(n: number): number`.

- [ ] **Step 1: Write the failing tests** for the five helpers, including 0/1/4/12-section tick counts, two sections at the same progress getting distinct ticks, and duplicate heading text.
- [ ] **Step 2: Run `pnpm test -- ruler-model`** → fails on missing module.
- [ ] **Step 3: Implement the module** (pure functions only, no imports).
- [ ] **Step 4: Run `pnpm test -- ruler-model`** → passes.
- [ ] **Step 5: Commit** (`feat(work): add the scroll ruler's tick model`).

### Task 2: The ruler component and its styles

**Files:** Create `src/components/work/scroll-ruler.tsx`, `src/components/work/scroll-ruler.css`, `src/components/work/scroll-ruler.test.tsx`

**Interfaces:**
- `export function ScrollRuler({ studySlug }: { studySlug: string })`.
- Reads `#wd-reader-scroll` (`READER_SCROLL_ID`), its `.wd-prose h2` headings, their `scroll-margin-top`.
- Writes `--wd-ruler-progress` (0–1) on the nav per scroll frame.
- Emits `<nav aria-label="Sections">` with one row per tick, a link per section (`href="#id"`, `aria-label` = heading text), a bright indicator, and one label element.
- Data attributes: `data-visible`, `data-active` (index of the hovered/focused section).

- [ ] **Step 1: Write the failing DOM tests**: 17 ticks and 4 links for the four-section fixture; no links for 0/1; 12 distinct ticks for twelve sections; scroll moves the indicator value; click calls `scrollTo` with the heading's offset and `behavior: "smooth"`; reduced motion asks for `"auto"`; hover shows the nearest section's label; a zero-scroll-height study renders `data-visible="false"`.
- [ ] **Step 2: Run `pnpm test -- scroll-ruler`** → fails (component missing).
- [ ] **Step 3: Implement the component and CSS** as described; measure on mount, on `ResizeObserver`, on `document.fonts.ready`, on `data-reveal` changes, and on `studySlug` change.
- [ ] **Step 4: Run the test file** → passes; run `pnpm test` → the whole suite still passes.
- [ ] **Step 5: Commit** (`feat(work): add the reader scroll ruler`).

### Task 3: Wire it into the reader and the entrance

**Files:** Modify `src/components/work/reader.tsx`, `src/components/work/entrance.css`

- [ ] **Step 1: Render** `<ScrollRuler studySlug={meta.slug} />` after the scroll container, inside `.wd-reader-panel`.
- [ ] **Step 2: CSS** — `[data-reveal="pending"] .wd-ruler { opacity: 0 }`, `[data-reveal="on"] .wd-ruler` runs `wd-enter-fade` on the existing 800ms curve at the last beat (480ms + `--wd-beat-lead`), and the reduced-motion block gets `animation: none`.
- [ ] **Step 3: Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.**
- [ ] **Step 4: Commit** (`feat(work): mount the ruler in the study reader`).

### Task 4: Browser verification

- [ ] Load `http://localhost:3006/work/systems-in-motion`; confirm 17 ticks, 4 section ticks at the headings, the bright tick tracks scroll, hover shows "The system", click lands the heading under the nav, and 375px width hides the ruler.
- [ ] Record evidence in the report and send `worker_done`.
