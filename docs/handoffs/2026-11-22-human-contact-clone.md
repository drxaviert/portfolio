# Handoff — Human Contact clone (2026-11-22)

**Goal:** credited live three.js rebuild of humancontact.com's home background (Wayback 2022-01-31) with an ADDED hover-to-scale interaction, as a /work case study.

**Reference spec:** `docs/superpowers/specs/2026-11-22-human-contact-clone-reference.md` (+ `human-contact-ref/` screenshots). The original is a 3s looping video of 7 dark matte props on a tilted staggered grid; no hover-scale existed. Work-page island scene (three r107) gives camera/tilt constants: FOV 28, pos (0,5,210), bg #111, fog 20–500, mouse tilt x 0.0002*(y-h/2), z 0.0001*(x-w/2), ease 1/6 per frame.

**Approved plan (Dat, 2026-11-22):**
1. Full-bleed three.js canvas, bg #111; 7 procedural props (laptop, headphones, notebook+pen, clapperboard, tin-can phone, bulb, takeaway cup), dark matte, tilted staggered grid tiled to viewport, soft lower-right shadows, subtle idle drift, field-wide mouse tilt.
2. Hover: raycast → spring scale ~1.25×, interruptible, pointer cursor. Build 2–3 variants (plain scale / scale+lift to camera / scale+neighbours ease aside) behind a toggle for A/B.
3. Overlay: wordmark (text recreation), nav, faded Poppins slogan (screen blend).
4. Fallbacks: reduced motion (no drift, instant hover), touch tap-pop, Safari/no-WebGL static render, pause off-screen.
5. Placement: `/work/human-contact` case study with live embed + standalone full-screen route; credit HUMANCONTACT INC; three.js code-split to those routes only.
6. Own worktree; give localhost + LAN URL (http://192.168.2.33:<port>); PR after Dat approves a variant.

**Decisions:** procedural geometry only, no original assets; hover framed as Dat's addition.
**Open:** prop geometry is interpretation (OBJs unrecoverable); video loop motion unknown.

## Progress (lead, 2026-11-22)
- Phase 1 done by DeepSeek worker ctx_58d4792abe31 (task_d2c1cb1225ce): /dev/human-contact, files in src/components/human-contact/ + src/app/dev/human-contact/. typecheck/lint/build pass; 60fps; dev server on :3001. Uncommitted.
- Blob shadows chosen over shadow maps. Hover pointer-only so far (touch/keyboard = Phase 2).
- Waiting on Dat to pick hover variant A/B/C.
- Dat picked variant A (Scale). Standalone route = /live/human-contact; study last in WORK_ORDER.
- Phase 2 plan: docs/handoffs/2026-11-22-human-contact-phase2-plan.md. Sent to same worker as dispatch ctx_04bb3e050109 (task_a9d17b53ebfb). Worker commits locally; lead pushes/PRs.
- Copy fix 67a4b42 done. 5 commits local, awaiting Dat approval to push/PR/merge. Dev :3001.
- Z-wave motion b661d8b (Dat request: static field, per-object Z bob+turn). Awaiting Dat review.
- Lighting A/B requested (3 presets on /dev ?light=1|2|3), dispatch follow-up of ctx_e4e8482f405c.
- Lighting presets e2372b7 on /dev ?light=1|2|3; awaiting Dat pick.
