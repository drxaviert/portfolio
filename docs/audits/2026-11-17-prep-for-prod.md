# Pre-launch audit — prep-for-prod (nine-lane sweep)

Audit only; no code changed. Branch `e590d04`, production build served on :3110 (`pnpm build` → `pnpm start -p 3110`), Playwright at 1440×900, 375×812, 390×844, JS-off, no-WebGL, Night/Day/Dawn. Scope: full sweep. Depth spent on E (states), H (leftovers), I (marketing), G (theming), D (forms); a11y/touch, performance, colour and worst-case-data are being deep-dived in parallel and are held at sweep depth here.

## Verdict

**Not yet.** One ship-blocker: the carousel dev tuner is mounted in the production build at `/?tune=1` (P1). Four should-fix (dead nav buttons, default 404 that ignores the theme, nav CSS missing off the homepage, metadata origin stuck at localhost), five low.

## A. Accessibility — no sweep-only findings

Deep dive in flight; not duplicated here. (Observed for that report: two `<h1>`s on every `/work/<slug>` direct load.)

## B. Performance — clean at sweep depth

All routes prerender (`next build` shows ○/◐ for every public route); one variable font via `next/font`; no images; carousel runs on WAAPI. The 180px blurred Horizon blobs in the Safari/CSS fallback are deliberate (`horizon-motion.css:9-14` explains the rasterise-once split) and are not a defect. P1 also ships a dev panel's bytes — counted once there.

## C. Mobile — clean at sweep depth

No horizontal overflow at 375/390 (`scrollWidth === innerWidth`); no `100vh`/`h-screen` in app code (`min-h-dvh`); the homepage/nav hover rules are behind `(hover: hover) and (pointer: fine)`, and the un-gated ones in `home-carousel.css:100,570` / `reader.css:140,405,611,631,818,891` only change colour, underline or `z-index` — none move or resize. The one that can stick after a tap is `.car-peek-edge:hover{--car-ring:6px}` (tablet, md+); low, left to the touch deep dive. Touch gets a 44px-row theme menu instead of the 28px segments.
Counter-note (design, not defect): at 375 the document is 920px tall and the nav dock sits at y=840, i.e. the theme toggle is below the first screen.

## D. Forms — clean

No form ships: the only `<input>`/`<select>` elements live in `/dev/*` tuners, which return 404 in production.

## E. Stability & states

| ID | Sev | file:line | Problem (evidence) | Fix | V/I |
| --- | --- | --- | --- | --- | --- |
| P3 | Med | `src/app/` (no `not-found.tsx`, `error.tsx`, `global-error.tsx`) | Wrong URL gets Next's stock 404: title "404: This page could not be found.", inline `height:100vh`, hardcoded `body{color:#000;background:#fff}`. In Night mode with a light OS the page renders `bodyBg rgb(255,255,255)` while `data-phase="night"` — a white page with the dark nav floating on it (`/nope`, `/work/nope`, both real 404s). | Add `src/app/not-found.tsx` using `bg-surface`/`text-on-surface` plus a "Back to work" link; the status code is already correct. | VISIBLE |
| P4 | Med | `src/components/nav/nav-dock.tsx:233-243`, `src/components/home/ring-hover.css:21,114` | The dock is rendered by the root layout on every route, but the styles that paint its bar come from `ring-hover.css`, which only the home components import. On `/nope` only 3 CSS chunks load (8 on `/`), `.ring-host`/`.ring-surface` are absent, the nav computes `position: static`, its fill is 0×0 and the Home orb sits at x=636 instead of 168. | Import `ring-hover.css` from `nav-dock.tsx` (or move `.ring-host`/`.ring-surface` base rules into `nav-dock.css`) so the nav never depends on a page chunk. | INVISIBLE |
| P5 | Low | `src/app/` (no `error.tsx`) | An uncaught render/handler error has no branded boundary; it falls through to Next's default client-exception page. No current trigger found (WebGL failure is handled — see Checked and fine). | Add `app/error.tsx` with a retry + link home. | VISIBLE |

Not applicable: data-driven views (no fetch, no client data hooks), so E1/E2/E3/E4 empty/error/loading branches have nothing to branch on. `/work/nope` correctly returns 404 rather than a soft 200.

## F. Motion — no objective defects at sweep depth

Reduced motion is wired at the token level (`globals.css:171`) and per component (`ring-hover.css:218`, `theme-toggle.tsx:344`); the theme change is a View Transition crossfade, not per-property tweening (`theme.ts:329-384`); resting UI snaps instead of animating (`theme-toggle.tsx:436-443`). Owner's 2026-11-13 motion decision respected; nothing taste-level reported.

## G. Theming

| ID | Sev | file:line | Problem (evidence) | Fix | V/I |
| --- | --- | --- | --- | --- | --- |
| P10 | Low | `src/app/layout.tsx:38-46` | `theme-color` is keyed to `prefers-color-scheme`, but the app theme is a manual choice. Night with light OS, and Day with dark OS, both keep the wrong chrome colour — verified: metas stay `#e5e5e5 (light)` / `#0d0d0d (dark)` while `data-phase="night"`/`"day"`. | Update the `theme-color` meta when the phase changes (in `applyMode`/`commitPhaseSwitch`), or emit one tag and set it from `--surface`. | VISIBLE |

Flash on refresh: none — `THEME_INIT_SCRIPT` (`layout.tsx:58`) sets `data-mode`/`data-phase`/`data-day-phase` and `.dark` in `<head>` before paint; Night stored → first paint is dark (`bodyBg rgb(13,13,13)` at `waitUntil: commit` + load). Day/Night/Auto and the Clock/Dawn/Midday/Dusk pin all resolve correctly, persist across reload and across `/` → `/work/title-sequence`, and `color-scheme` flips per phase (`globals.css:381,461,532,604`). Night verified on `/` and on a study's reader. Only the 404 (P3) ignores the theme.

## H. Content & leftovers

| ID | Sev | file:line | Problem (evidence) | Fix | V/I |
| --- | --- | --- | --- | --- | --- |
| P1 | High | `src/components/home/carousel/home-carousel.tsx:437,1844-1845,42`; `carousel-tuner.tsx:84,141` | The dev carousel tuner mounts in production. `?tune=1` opens a fixed dark panel ("Carousel tuner", duration/easing/edge/hover-peek sliders) over the nav on the live homepage — reproduced on the production build, no `NODE_ENV` gate anywhere. The component is statically imported, so its code ships to every visitor, and the *shipped* carousel values live in the panel's `DEFAULT_SETTINGS` (line 42). | Gate on `process.env.NODE_ENV === "development"` and `dynamic(() => import("./carousel-tuner"))`; move `DEFAULT_SETTINGS` into a shipped settings module. | VISIBLE |
| P2 | Med | `src/components/home/nav-items.tsx:18-22,435-446,460-477` | Play, About and the "Design system" glyph are `<button>`s with no handler, focusable and announced as buttons on every page; `/design-system` 404s and `/dev/system` is production-gated. Clicking any of them does nothing. | Decide: wire to routes, or render them as non-interactive until the pages exist (and drop `aria-label="Design system"` if no destination). | VISIBLE |

Clean: no `console.log`/`debugger`/`TODO`/`FIXME`/lorem/`example.com`/`href="#"` anywhere in `src` or `content`; `/dev/*` (prototype, proto/entrance, proto/faux-ui, proto/work-carousel, play-card, system) all return 404 in production and are `Disallow`ed in robots; the glow tuner, phase picker and entrance harness are behind those routes only. The three studies are real prose with real frontmatter (no fabricated proof or testimonials). `/favicon.ico` is the custom monogram, not the framework default.

## I. Marketing & SEO

| ID | Sev | file:line | Problem (evidence) | Fix | V/I |
| --- | --- | --- | --- | --- | --- |
| P6 | Med | `src/lib/site.ts:6` → `layout.tsx:17`, `robots.ts:11`, `sitemap.ts:7,9`, `work-metadata.ts:29` | The production origin is an env var with a `http://localhost:3000` fallback, and nothing in the repo sets it. Served output: `<meta property="og:url" content="http://localhost:3000">`, `og:image`/`twitter:image` on localhost, `Sitemap: http://localhost:3000/sitemap.xml`, and all four `<loc>` values localhost. Every share preview and the sitemap are wrong until the deploy sets `NEXT_PUBLIC_SITE_URL`. | Set `NEXT_PUBLIC_SITE_URL` in the deploy (the code comment already says so); optionally fail the build when it is unset in production. | INVISIBLE |
| P7 | Low | `src/app/layout.tsx:16-36` | Site title is "Portfolio" and the description "Design engineer portfolio." — no name, no specialism, identical on every tab, search result and unfurl. The words aren't in the repo, so they can't be invented here. | Replace with name + one-line positioning, then keep the per-study template. | INVISIBLE |
| P8 | Low | `src/app/layout.tsx` (no `alternates.canonical`), verified in served HTML | No `<link rel="canonical">` on any route, while `/?tune=1` is a second URL for the homepage and is crawlable. | `alternates: { canonical: "/" }` in the root metadata and `/work/<slug>` in `workMetadata`. | INVISIBLE |
| P9 | Low | `src/app/` (no `apple-icon`) | Only 32×32 icons exist (`icon.tsx`, `favicon.ico`); `apple-touch-icon` is a 404, so iOS uses a page screenshot when the site is added to the home screen. | Add `src/app/apple-icon.tsx` (180×180) reusing the monogram. | VISIBLE |

Present and correct: per-study titles/descriptions/OG (`workMetadata`), `metadataBase`, 1200×630 OG image with alt text, `twitter:card summary_large_image`, `robots.txt` allowing `/` with the sitemap, `sitemap.xml` listing exactly `/` + the three studies, `noindex` on 404s, no leftover `Disallow: /`, no analytics or consent banner to review, no `force-dynamic`.

## Needs a real device

- iPhone Safari: the CSS fallback Horizon (no WebGL by design) plus the theme row — tap Day, tap a phase, confirm the row opens, closes on outside tap, and doesn't collide with the nav.
- iPhone/Android: scroll the homepage at 375 — the nav and theme toggle sit below the fold (doc 920px); confirm that is acceptable on hardware, with the URL bar showing.
- Reduced motion on a mid-range phone: hard load `/`, then open a study and close it — confirm the entrance and morph degrade to fades and nothing janks.
- Screen reader: open a study, confirm focus is trapped in the reader and returns to the card; confirm the closed phase row is silent.

## Needs a human

- **P1 owner sign-off** is only needed for removing the tuner from the shipped UI; the gate is a one-line fix.
- **P2**: the nav promises Play, About and a design system. Ship them, or make the labels non-interactive.
- **P6**: the real production origin (no domain in the repo).
- **P7**: the name and one-line positioning for `<title>`/description.
- **P3/P4**: design of the 404 (and whether it should carry the nav at all).
- **Tracker**: `tracker-widget.tsx:76` labels deterministic placeholder data as a "Contribution tracker" (honest for AT, invisible to sighted visitors) — wire real data or keep it as decoration, owner's call. Palette deliberately not reported.
- **Slivers at 375**: the three decorative empty cards (`home-cards.tsx:125`) stack into ~220px of blank space and push the nav below the fold. By design per Figma; flagging for the mobile decision only.

## Checked and fine

Home renders with JS off (content in HTML, veil clears via CSS); `/work/<slug>` direct load server-renders the full study (2.6k chars) and the drawer opens/closes with Escape, URL and title correct; unknown slugs return a real 404; all `/dev/*` 404 in production; no-WebGL run renders the CSS fallback with zero errors and zero page errors; no horizontal overflow at 375/390; theme persists across reload and navigation; `lang="en"` and one `<main>` per route; no `transition: all` and no CSS transition of layout properties anywhere in `src`; no secrets, no tracked `.env`, no localhost strings other than the documented `SITE_URL` fallback.

## Verification

```
pnpm build        → Compiled successfully; TypeScript OK; 22 static pages; all public routes ○/◐
pnpm start -p 3110 → Ready in 140ms
GET / 200 · /work/{three slugs} 200 · /work/nope 404 · /work 308 → / · /nope 404
GET /dev/{system,prototype,play-card,proto/work-carousel} 404 · /design-system 404
GET /robots.txt 200 · /sitemap.xml 200 · /opengraph-image.png 200 (1200×630) · /apple-touch-icon.png 404
Playwright: 1440/375/390 (scrollWidth === innerWidth), JS-off, no-WebGL, light/dark OS × day/night phase, ?tune=1 panel present
```

No fixes applied, so no typecheck/lint/test run is claimed. `git status` is clean; the production server was stopped.
