# Handoff: reader scroll ruler (new request) + drawer back-fixes ship (2026-11-16)

**Lead:** Opus, kept open. My session id: orca_session_id:f05171cb-bfe4-45b8-99fc-48982226ad7e. Current coordinator task: `task_94d9afcb9ffd`, dispatch `ctx_749435469f64`. Worker: DeepSeek OpenCode, terminal structworker_6c894ea3…, latest dispatch `ctx_396f6cfc7e5f`.

## Back-fixes job (approved by Dat; shipping in flight)
- Branch `drxaviert/drawer-back-fixes`, from main at 19dd367.
- Commits:
  - `f06e6bf`: the nav now enters the drawer whenever a study is restored by Back/Forward. The dock used to enter only from the open morph's layout effect.
  - `e34426a`: close FLIPs into the card the drawer was opened from (`data-drawer-origin` + `workOrigin` history state). Direct loads use their own card, else FEATURED_SLUG (now in `src/lib/work-order.ts`). The 0.95 scale exit is only a fallback when that card is missing.
- Bug 1 (stale @modal node) no longer reproduces since 3414edd; no change made.
- Back pressed mid-close is clean in all 3 flows.
- Real-iPhone blur check is PARKED: Dat has no iPhone.
- 306 tests, typecheck, lint and build green. Report: `.superpowers/drawer-back-fixes/report.md`.
- The worker was told to push, open the PR, wait for CI + Vercel, merge with a merge commit, and report the PR number and merge SHA.
- **Next:** verify the merge with `gh pr view` and `git log origin/main`. Then send worker_done for task_94d9afcb9ffd: PR number, merge SHA, evidence, iPhone check parked, dev servers running (:3006 dev, :3016 prod).

## New request: scroll ruler on the study page (brainstorming, nothing built)
- Dat's image: a column of ~15 short grey ticks at the right edge of a dark page. A longer, brighter tick marks the current position.
- Name: scroll ruler / tick-mark scroll indicator.
- Where it goes: the reader scroll container `#wd-reader-scroll` (src/components/work/reader.tsx:47, READER_SCROLL_ID in parts.tsx:28).
- Content: studies are MDX in content/work/*.mdx and have `##` headings, so ticks could map to sections.
- Open question to Dat: what it's for. Option one is ambient reading progress only. Option two is navigation: ticks are sections, clickable or hover-labelled to jump. That answer decides the design.
- Process: superpowers:brainstorming → approaches → short design doc in docs/superpowers/specs/ → approval → writing-plans → worker.
- Rules: emil skills (animation/touch). Keep existing motion; Dat rejected a motion pass. Mobile behaviour matters (hide it, or a thin variant?). Respect reduced motion.

## Gotchas
- Restarting the :3006 dev server: run it hidden and detached (`Start-Process`, output to dev-3006.log); never pipe it.
- Rebuild :3016 from a throwaway copy in %TEMP%\opencode\prod-3016*.
- Never stage dev-3006.log.
- The guard hook blocks message bodies that contain literal `git rm` / `rm` text; send briefs from a file.
- Links for Dat: always give both localhost and http://192.168.2.33:<port>.

## Update (Dat's answer)
- Back-fixes shipped as PR #31, merge commit e512a5a. worker_done was sent for task_94d9afcb9ffd.
- Dat: the ruler is **section navigation you can hover and click**.
- Approaches put to Dat: A = one tick per `##` section, placed by where the section sits in the text. B = a dense, evenly spaced ruler like his image, with section ticks marked, the current position as the long bright tick, hover for the section name, and click to jump (lead's pick). DAT PICKED B. Short design doc: docs/superpowers/specs/2026-11-16-reader-scroll-ruler-design.md (Dat added: must adapt automatically to any new study — spec has a "Works for any study" section; awaiting approval; new branch from main e512a5a when building). Then → writing-plans → worker.
- Lead's default calls: hidden on touch/phone widths (no hover there); smooth scroll, instant under reduced motion; label tooltip to the left of the tick; keyboard reachable (each section tick is a link to #heading-id).

## Shipped (5552b74, branch `drxaviert/reader-scroll-ruler`)

Built from the three approved turns (spec B, the Orca-style preview, the gutter and snap): a dense 17-tick ruler that grows one tick per section past 17.

- **Where:** centred in the gutter between the text column's right edge and the panel's right edge, 40px minimum; measured from the column on every resize, reflow and morph, so the gaps match at every width (97.3px each side at 1024, 321.3 at 1920). It holds the panel's vertical centre.
- **Sections:** read from the rendered `##` headings of whatever study is open, ids slugified and de-duplicated at measure time. No per-study config.
- **Every tick previews:** the section as a bold title, the text at that tick clamped to three lines (a figure speaks through its caption); one card that slides between ticks instead of reopening.
- **Click** any tick to jump to it; sections stay the only tab stops and focus shows the card.
- **The bright mark** is not a progress bar: it holds a section's tick until that heading crosses the 124px line, then snaps with the theme toggle's stretch and snap (180ms leading, 120ms lag + 220ms trailing, retargeting mid-flight).
- **Hide rules:** touch (`hover: none`) and any width where the panel leaves less than 40 + 18 + 16px — 715px today.
- **Reduced motion:** every move lands in one write, no flight.
- Checks at ship: 356 tests, typecheck, lint and build green.

**Parked — design pass:** the Night preview card sits on `--surface-container-highest` (#404040); Dat's Orca reference is near-black. He will come back for a design pass on the card's surface and shadow; nothing else is open on the ruler.

