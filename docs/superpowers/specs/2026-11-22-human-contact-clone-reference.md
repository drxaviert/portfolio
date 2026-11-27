# HUMANCONTACT clone reference (archived 2022-01-31 snapshot)

Source: https://web.archive.org/web/20220131140746/https://humancontact.com/
Credit: site is HUMANCONTACT INC. (humancontact.com). Nav carries a logo link to https://merjj.com/ (MERGE, likely the build/sister studio; not confirmed as the developer). No individual developer credit found in the bundle. Any clone must credit HUMANCONTACT.

Screenshots (2 of 8 budget used): `human-contact-ref/01-home-landing.png`, `human-contact-ref/02-home-hover-paused-frame.png`.

## KEY FINDING: premise does not match this snapshot

- The home page background of dark floating objects (laptop, headphones, notebook with pen, clapperboard, tin cans on string, light bulb, coffee cup) is NOT three.js. It is a pre-rendered looping `<video>`: `https://admin.humancontact.com/wp-content/uploads/2020/01/landing-1.mp4`, 1920x1080, duration 3.03 s, autoplay/loop/muted, no canvas on the page (verified: `document.querySelectorAll('canvas')` is empty). Mobile gets a still instead (`.../hc-landing.png`).
- Nothing in the home objects scales on hover. The only hover-scale code in the CSS is:
  - nav items: `.menus .menu a:hover, button:hover { transform: scale(1.1); transition: transform .2s ease }`
  - client logos on About: `.logo:hover { transform: scale(1.15) !important }`
- Real three.js exists (r107, bundled in `static/js/2.18b861f4.chunk.js`; `WebGLRenderer`, `Raycaster`, `OBJLoader`, `GlitchPass` present) but is used only on the Work screen (`screenIndex === 2`) for one "island" mesh. `Raycaster` is in the vendor bundle but main.js never uses hover picking (no `raycaster` in app code found).
- So "background 3D objects that scale on hover" is probably a different snapshot/version, or a misremembered effect. Not found in 2022-01-31. Earlier snapshots (2020-12-03 redirect for /work) were not inspected in detail.
- Recommendation: for the clone, either (a) rebuild the home loop procedurally in three.js (grid of floating props, see below) and add hover scale as a new design choice, clearly marked as not in the original, or (b) get Dat to confirm which page he saw.

## Layout (home, 2999x1337 viewport)

- Fullscreen background (`#landingbackground`, 100vw x 100vh, overflow hidden) holding the video, `min-width:100%`.
- `#landingcover` overlay: starts `rgba(0,0,0,.4)` + `backdrop-filter: blur(10px)`; after 1 s gets class `loaded` -> blur 0, `rgba(0,0,0,.2)`; `transition: all 2s ease`.
- Centre: HUMANCONTACT wordmark, white serif caps, very wide letter-spacing, about 40% of width (from `humancontact.png` logo image; `#img-logo` is 38% width, min 240px, centred, pointer-events none).
- Top-left small "HC." monogram.
- Nav (`.menus .menu`): absolute, `left:50%; top:60px`, centred; flex `ul`, items margin 0 20px, 18px Source Sans Pro, white, `cursor:default`. Items in order: ABOUT, WORK, HUMANS, CAREERS, CONTACT, [MERGE logo -> merjj.com, 52px wide], FRANCAIS (language toggle, colour `#c5c5c5`). A yellow `#menuIndicator` bar (`#e8bf2f`, 6px high, at left 20px, top 64px) is the active-item marker.
- Page `<title>`: "HUMANCONTACT". Tab bar text on site: "HUMANCONTACT INC."
- Other routes: /about, /work, /humans, /careers, /contact (React Router SPA; CRA build, main.44b4a09a.chunk.js).

## Copy (from `window.hc.content.main`, EN)

- Slogan (About): "WE ARE THE MOST VERSATILE AGENCY OF OUR KIND"
- About description starts: "As a full-service creative agency, we are proud to offer our clients an unrivaled breadth of capabilities and expertise..." (truncated in capture; About toggles between "About Us" and "Our Clients" every 6 s)
- Work: "Our Featured Work", button "VIEW PROJECTS", links "view more"
- Contact form: "Hi, let us help you!" / "What is your name?" / "What is your email?" / "What can we help you with?"
- Careers: "Job Openings"
- Projects (9): Kruger Products, Fine Fettle Tea, KFC RGM Conference, Merit Travel, Rexel Wire & Cable, BDO Canada, Carrot Rewards, Run Ottawa, Kruger Products (2020)
- FR copy exists for all strings (language toggle).

## Fonts and colours

- Body default: system stack (-apple-system, Segoe UI, Roboto...). Nav: Source Sans Pro 18px, weight 400. Headings: Poppins (weights 200-700; slogan h1 Poppins 600, `10vh` size, uppercase, `hsla(0,0%,100%,.25)`, `mix-blend-mode: screen`). Logo wordmark is an image.
- Colours: `html` bg `#111`; `.backgroundscene` bg `#111`; scene background hex `0x111111` (ve=1118481); About bg `#111`; project body `#202020`; nav text `#fff`, edge `grey`, language `#c5c5c5`; accent `#e8bf2f`.

## Three.js scene (Work screen only)

Setup from `main.44b4a09a.chunk.js` class `we`:

```js
camera = new THREE.PerspectiveCamera(28, w/h, 1, 1e4); camera.position.set(0, 5, 210);
scene.background = new THREE.Color(0x111111);
lights: 4 PointLights (distance 500): white i=1 @(250,-50,50); white i=1 @(50,250,50);
        white i=0 "dimmer" @(-50,50,100); black(0x000000) i=1 @(-50,50,80)
scene.fog = new THREE.Fog(0x111111, 20, 500);
renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); setPixelRatio(devicePixelRatio)
composer = EffectComposer(renderer) + RenderPass + GlitchPass (disabled; glitchOnce(600ms) hook)
TrackballControls(rotateSpeed 0, zoomSpeed 2.2, panSpeed 1, dynamicDampingFactor .3)
```

- Container `.backgroundscene`: `position:absolute; pointer-events:none; background:#111`, canvas sized to window; sits behind `#content` (z-index 10).
- Objects: ONE mesh group named "island", loaded by OBJLoader from one of five random OBJ files (`coffee`, `headphones`, `laptop`, `notebook`, `slate`; the code picks `Math.floor(Math.random()*(len-1))` so the 5th, `slate`, never loads). Scaled 1.25, `y` offset -24 (0 for laptop), x=-22 (-14 below 950px wide). Material for every child: `MeshStandardMaterial`-class (minified `K.t`; confirm class) colour `0x555555`, transparent, opacity 0 until Work screen (GSAP fade 0.4 s). Visible only when `screenIndex === 2`.
- Idle motion per frame: `rotation.y += 0.004 * rotationVelocity` (rotationVelocity = 1; ~0.24 rad/s at 60 fps). Mouse tilt: `rotation.x += (0.0002 * (clientY - h/2) - rotation.x)/6`; `rotation.z += (0.0001 * (clientX - w/2) - rotation.z)/6` (easing factor 1/6 per frame). Skipped on mobile and IE.
- Also a `video` plane (BoxGeometry 50x50x10, VideoTexture, z=20) used for the About video; fog far toggles 500 <-> 120 via GSAP 1 s.
- Perf fallback: if FPS < 20 for >30 frames in first 10 s, hides canvas, sets body `#111111`, shows `.workscenereplacement`.
- No hover scaling, no raycasting on objects, no click behaviour in this scene. Mouse also computes a world-space point (`updateCamera`, unprojecting to z=0) but it is stored and not used for hover in the code seen.
- Work screen has a custom cursor `#workcursor` that scales 0 <-> 1 (GSAP 0.4 s) over project titles / "view more", and grows to 2x diagonal over 1.2 s before routing to `/work/<slug>` (circle-reveal transition).

## Home loop (to reconstruct procedurally)

From frame screenshot 01: dark grey (#111-#222) matte props arranged on a loose staggered grid (about 8 columns x 4 rows in a 2000x892 view), each tilted at different angles with soft blurred drop shadows to the lower right; items cycle through 7 types (laptop open at angle, over-ear headphones, notebook with pen, clapperboard, two tin cans with string, filament bulb, takeaway cup). Cover overlay darkens everything (~20% black). Idle: the 3 s loop suggests slow float/rotate; exact motion NOT determined (only 1 frame inspected).

## Interaction summary

- Mouse parallax: only the Work island tilt above. Home video does not react.
- Hover scale: nav links 1.1 (0.2 s ease), client logos 1.15 (inline scale per logo, transform transition).
- Scroll: Work page progress bar `#workscrollbar` (width = scroll %), project cards toggle `.active` when in view. No scroll behaviour on home.
- Mobile: `isMobile` (UA regex) swaps video for still image; island rotation/tilt disabled.

## Gaps / not determined

- Could not load the OBJ files (Wayback and live site return HTML 404-ish pages), so exact geometry and vertex counts of the five props are unknown. The live site is now a different WordPress site.
- Could not get the SPA to route to /work inside the archive (click did not navigate), so the island was never seen rendering; mesh appearance is inferred from code.
- Exact material class (`K.t`) and the loop video's motion not confirmed. Video file itself not downloaded/analysed.
- No evidence of hover-scaling 3D objects anywhere in this snapshot. Earlier/later snapshots not checked.
