# Design Canvas — Design

Date: 2026-11-11 · Status: draft for approval (builder check incorporated) · Owner: Dat (personal use)

## Intent and why
A personal infinite design canvas, replacing a paid Paper Design subscription. What Dat values in Paper: viewing many designs at once and roaming around checking them, dropping inspiration images beside work for comparison, and organizing work into pages. Dat also wants to edit by hand on the canvas, and agents (Claude/DeepSeek workers) edit the same designs. Longer term, the canvas is published read-only on Dat's portfolio so visitors can drag around it like Figma and see the design thinking.

## Goals
1. Infinite board with Figma-like navigation: trackpad pinch-zoom, two-finger pan, space+drag, ctrl/cmd+wheel zoom, zoom-to-fit / zoom-to-selection.
2. Pages: sidebar list; each page is a separate board.
3. Artboards: HTML designs rendered live with the portfolio's real tokens (src/app/globals.css). An artboard re-renders in place when its file changes (e.g. an agent edited it).
4. Inspiration: drag-drop or paste images onto the board; move/resize them.
5. Live frames: a frame showing a URL (a portfolio route — local dev server when editing, deployed route on the public site). View-only.
6. Hand editing inside artboards:
   - Select by clicking an element, or via a per-artboard layers tree; arrow keys move to parent/child.
   - Properties panel: layout (direction, gap, alignment), padding/margin, size (fixed / fill / hug), fill colour, radius, shadow, type (font, size, weight, line-height).
   - Tokens-first: colour/spacing/shadow fields offer globals.css tokens; raw values allowed.
   - Double-click text to edit inline.
   - Reorder children by dragging in the layers tree. Free drag only for absolutely-positioned elements (flex layouts have no meaningful free position).
   - Move/resize artboards, images and frames on the board.
7. Undo/redo with one timeline covering both hand edits and agent edits.
8. Agent MCP (local): list pages/artboards, create page/artboard, write_html, update_styles, set_text, get_tree (text-first: structure + computed layout, so agents rarely need images), screenshot (on demand), export_jsx (deliberate conversion of an artboard to a React component).
9. Public viewer: read-only, embedded in the Next.js portfolio, free roam (pan/zoom/switch pages — no guided tour), built statically from repo files. Only pages in the published root (`design/`) are included.

## Non-goals (v1)
Multiplayer/live collaboration; comments; a component/instance system; vector/pen drawing; editing React components from the canvas; guided tours or annotations for visitors; prototyping/click-through links.

## Anti-goals (failure even if it "works")
- Needs a paid licence, subscription, or a hosted backend/database.
- Designs drift from the real tokens (artboards must render with the portfolio's actual globals.css).
- Public viewer is heavy or slow on the portfolio, or leaks private pages or inspiration images.
- Canvas edits rewrite whole files or produce noisy diffs.

## Constraints
- Windows 11; used inside an Orca pane as a local web app on localhost. Orca's own code is not modified.
- Lives inside the portfolio repo (Next.js, pnpm, Node 24). Tokens use Material 3 naming in src/app/globals.css; cards use shadow-light / shadow-dark styles, no borders.
- Dev servers for workers run via `pnpm dev:log` (piped `next dev` hangs — next.js#96216).
- Agent loops should be text-first to keep image/token cost low.

## Approaches considered
1. **Custom canvas (picked).** React surface; artboards positioned with CSS transforms; our own viewport, selection, layers and properties panel. Free, fully owned, small and fast public viewer, navigation feel tunable, no conflict with the file-based model. The parts other options provide (pan/zoom, drag boxes) are the easy parts; the hard parts are custom in every option.
2. tldraw SDK — rejected: public production use requires a paid licence or watermark (against the reason for the project), and it owns its own document format, fighting the file-based model.
3. React Flow — rejected: diagram-oriented, adds weight to the public viewer, saves little.
4. Excalidraw — rejected: hand-drawn sketch tool, not live HTML artboards.

Storage approaches considered: (A) repo files as source of truth (real components, git history, agents edit files directly, but hand edits into TSX are hard); (B) a separate design document like Paper/Figma (easy hand editing and undo, but export step and drift). **Picked: hybrid** — artboards are plain HTML files in the repo with a stable `data-id` on every element; canvas edits patch only the touched attributes by `data-id`; React conversion is a deliberate export step.

## Decided
- Custom canvas (approach 1) + hybrid HTML-file storage.
- Editor is a local web app opened in an Orca pane; public viewer is read-only inside the portfolio.
- One shared board renderer used by both editor and viewer, so visitors see exactly what Dat sees.
- Editing scope as in Goal 6; agent tools as in Goal 8; viewer is free-roam only.
- Two content roots. Published pages live in the portfolio repo under `design/`. Private pages and private inspiration live in a separate private git repo, `C:\Users\Dat\orca\design-private` (same folder structure). The editor reads both roots and shows them together; a page's root determines privacy. Publishing a page = moving its folder from the private root to `design/` (an editor action). The public viewer build reads only `design/`, so private work can never enter the portfolio repo or its git history. Images inside a published page are published.

## Calls made by Claude (Dat may override)
- Canvas code lives as a package inside the portfolio repo (not a separate repo).
- Design content lives in one folder per page (`<root>/<page-slug>/`, roots per "Decided") containing a `page.json` (name, order, board items with id, type artboard|image|frame, x, y, w, h, file/src/url, optional per-image `source` link) plus `<artboard>.html` files and an `assets/` folder for images.
- Tokens-first property fields with raw values allowed.
- Styling: artboard HTML uses inline styles plus CSS custom properties from globals.css (`var(--…)`); no Tailwind or classes in artboards. The properties panel patches the `style` attribute by `data-id`. globals.css has no shadow-light/shadow-dark token today — builder adds shadow tokens to globals.css (matching the existing card shadow styles) so the panel can offer them.
- Saving/undo: every hand edit autosaves to disk immediately (drags/typing debounced, write on release). Undo history is in memory per editor session; one timeline, latest change first, regardless of author — undoing past an agent edit reverts it. Editor ignores watcher events for its own writes (no echo loop). Git is the long-term history.
- Runtime: the editor + local file server + MCP run as one standalone local Node process on its own port, independent of `next dev`; started with a single pnpm script. The shared board renderer is a package imported by both the editor and the portfolio viewer.
- Live frames: on the public site they point at the portfolio's own deployed routes (same origin); each frame stores url, width, height (viewport preset desktop/mobile). Public, no-auth routes only. Builder checks next.config headers allow same-origin framing.
- Layout model: flexbox only in v1 (grid out of scope). Fill/hug/fixed map to flex-grow/align-self stretch, fit-content, explicit px. Panel shows authored values, with computed value as a hint. Unrecognised styles are preserved untouched.
- data-ids: MCP write tools assign ids on write. Files lacking ids (hand-written) get ids added once on first load — a one-time diff is acceptable.
- Scale and snapshots: target up to ~30 artboards+images per page. Snapshots are generated by the local editor (it already renders artboards) and committed alongside the page as PNG/WebP; no headless browser in CI. Viewer is lazy-loaded on its own route, not in the portfolio's main bundle.
- Input: editor supports Windows precision touchpad and mouse (Chrome/Edge/Orca's Chromium). Public viewer additionally supports touch (one-finger pan, pinch zoom) on phones.
- export_jsx: outputs a React component following the portfolio's existing styling convention in src/ (builder inspects and matches it), mapping tokens to the same variables.
- Extra v1 basics: duplicate and copy/paste of artboards, images and frames, including across pages; fonts limited to the ones the portfolio loads. PNG/PDF export is out of v1.
- Performance: only artboards near the viewport render live; others show snapshots. Applies to editor and viewer.
- Agent edits are detected by a file watcher and enter the same undo timeline.

## Left to the builder
- Artboard isolation (iframe vs shadow DOM) and how tokens/fonts are injected.
- Snapshot format and cache invalidation.
- HTML parsing/patching library.
- Local server internals (file read/write/watch, live-reload transport) and MCP transport.
- Package/workspace layout, routes, keyboard shortcuts, testing strategy.
- Phasing (reasoned: agents author most designs today, so MCP gives value soonest): (1) board + pages + artboards + images, view/arrange; (2) MCP so agents author artboards; (3) hand editing + undo; (4) live frames; (5) public viewer.
