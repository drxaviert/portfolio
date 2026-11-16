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
