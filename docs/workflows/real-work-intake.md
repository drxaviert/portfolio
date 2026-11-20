# Real work intake: turning a project into a case study

The portfolio exists to impress viewers and land a design engineer job. The author's work is motion
graphics: components, scripts and procedural systems built in After Effects, Cinema 4D and Houdini,
plus UI animation for SaaS videos. There is no interactive product work yet.

So every case study tells the same story — *I build systems that produce motion* — and each one
proves the system can live in a product by rebuilding its core idea as something interactive on the
web.

## 1. Media

Images and video are encoded and hosted by `pnpm post`; only a small JSON manifest is committed.

1. Drop the originals in `media/inbox/` (gitignored, like `media/archive/`).
2. Run `pnpm post` from the repo root. It needs Node 24, `ffmpeg` and `ffprobe` on `PATH`.
3. Commit `content/media/<id>.json` once the run prints `ok` for every file.

For each file in the inbox the script derives an id from the filename and a sha256 prefix, for
example `pipeline-test-loop-c0fe9c23ef`, then:

- **Image:** AVIF and WebP at 640 / 1280 / 1920 / 2560 that fall below the source width, plus the
  source width itself; never upscaled. EXIF orientation is applied. A 16px WebP becomes the inline
  `lqip` blur.
- **Video:** H.264 MP4 at CRF 20, preset `slow`, `-movflags +faststart`, height capped at 1080;
  audio stripped unless `--audio`. AVIF and JPG posters from `--poster-at` (default 0). `--webm`
  adds a VP9 file.
- Uploads to `media/<id>/` on Vercel Blob, public and cached for a year.
- Writes `content/media/<id>.json` and moves the original to `media/archive/<id>.<ext>`. The script
  never deletes an archived original.

Re-running skips a file whose manifest already exists. The id is content-addressed, so an unchanged
file is skipped and an edited file becomes a new id.

### Flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Encode in a temp directory and print what would upload and write; no uploads, files or credentials. |
| `--alt "<text>"` | Alt text for a single-file inbox. With several files it is ignored and each file is prompted. |
| `--audio` | Keep the audio track: AAC 128k in the MP4, Opus 96k in the WebM. Default is to strip it. |
| `--webm` | Also encode a VP9 WebM. |
| `--poster-at <sec>` | Poster frame timestamp, default `0`. It must be inside the clip's duration. |
| `--post "<caption>"` | Also write `content/posts/<yyyy-mm-dd>-<slug>.mdx`, frontmatter only (`date`, `caption`, `media: [ids]`). |
| `--study <slug>` | Validate the slug against the studies the site can open, then print `Paste into content/work/<slug>.mdx:` above a `<Figure><Media /></Figure>` snippet for each id ingested in the run; the slug does not filter. An unknown slug is a usage error before any encode or upload. |
| `--help`, `-h` | Print the flags and the environment notes. |

The script takes flags only; there are no positional arguments. Hidden files and unknown extensions
are skipped. A failure exits `1`, a usage error `2`.

### Reference an id from content

```mdx
<Figure media="pipeline-test-still-4a9b86e544" caption="The wall at the end of week two." />
```

`<Media id="…" />` works anywhere in a study, and `StepFigure` and `ContactSheet` take the same
`media` id. For the study hero and the featured card, set the frontmatter:

```yaml
cover: "media:pipeline-test-loop-c0fe9c23ef"
```

An unknown id, or a manifest that does not validate, fails the build — see
[media.md](../design-system/media.md).

### Blob auth

Auth lives in `.env.blob` at the repo root as `BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`; the `.env*`
gitignore rule covers it. Pull it with `pnpm blob:env`, which runs
`vercel env pull .env.blob --environment=production --yes`. The Vercel project must be linked first;
that creates `.vercel/` (gitignored).

The OIDC token lasts about 12 hours. `pnpm post` decodes its `exp` and re-pulls before encoding when
the token is missing, undecodable, or within 15 minutes of expiry. `--dry-run` never needs it.
`BLOB_READ_WRITE_TOKEN` in `.env.local` or the environment also works and is never refreshed.

The store must be **public**: uploads ask for `access: "public"`, and a store's access mode cannot
be changed after creation.

### Hobby limits

- 1 GB storage and 10 GB transfer per month; going over blocks Blob for about 30 days. Hobby is
  never billed.
- Target 2–6 MB per video loop. The script warns over 6 MB and fails over 10 MB.
- Images avoid Vercel's optimiser: widths are generated ahead of time and picked by the browser
  through `<picture>`/`srcset`, so the Hobby allowance of 5K transformations a month is not used.
  `next.config.ts` lists the Blob host in `images.remotePatterns` only as the allow-list for a
  future `next/image`.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `blob upload was rejected (auth)` | Token expired or unreadable. Run `pnpm blob:env`. If the pull cannot find the project, run `vercel link` first and pull again. |
| Upload rejected on a working token | The store is private. Create a public store, connect it to the project, re-pull `.env.blob`. |
| `ffmpeg failed` / `spawn ffmpeg ENOENT` / `spawn ffprobe ENOENT` | `ffmpeg` and `ffprobe` are not on `PATH`. |
| `--poster-at … is past the … duration` | Pick a timestamp inside the clip. It is checked before encoding and before any upload. |
| `over the 10 MB cap` | Shorten the clip or re-encode the source at a higher CRF; the script has no CRF flag. |
| Safari playback or seeking | Blob answers Range requests with `206` and `Accept-Ranges: bytes` (verified 2026-11-19), so MP4 on Blob is fine. |
| Every file says `skip` | Each already has a manifest; a changed source file produces a new id, so the skip only means a safe re-run. |

## 2. Intake

Everything for a project goes in `content/work/<slug>/`:

- Renders and video exports, before they are posted (originals end up in `media/archive/`)
- Screenshots of node graphs, expressions, rigs
- `notes.md` with rough notes (bullets are fine)

Never commit a source video or a full-size render: run it through the media steps above and reference
its id. The orchestrator lists what is there and what is missing.

## 3. Interview

The orchestrator asks 5–8 short, specific questions grounded in that material:

- What was the brief or problem?
- What are the system's inputs and controls?
- What was parameterized, and what was hand-animated?
- Which tools or scripts were built to avoid manual work?
- What broke?
- Which options were rejected, and why?

The answers become the story.

## 4. Outline

Order the decision points. Each one needs one piece of evidence: a before/after, a rejected option, a
node graph, a parameter sweep. Choose the single key moment for the featured home card.

## 5. Build

Same loop as all site work: a DeepSeek worker in its own worktree and port builds a dev proto with
variant toggles:

- The MDX case study at `/work/<slug>` — narrow text column, wide media breakouts, captions,
  footnotes, and a decision table or step-through figure where useful.
- **One** interactive web translation of the core system. A Houdini or C4D procedural setup becomes
  a three.js/canvas scene with live parameter controls; a SaaS promo UI animation becomes a real
  clickable component.
- The featured-card scene for the key moment.

The author picks variants, then we merge. Motion specs are logged to `docs/design-system/motion.md`.

## 6. Next project

Case studies chain to each other in the order set in the content index.

## Presentation references

The site follows Emil Kowalski (emilkowal.ski) and Rauno Freiberg (rauno.me): restraint, small
polished interaction demos, little text. Each case study's interactive translation follows Bartosz
Ciechanowski (ciechanow.ski) — live parameter sliders that expose the system the way a procedural rig
exposes controls — with Josh Comeau (joshwcomeau.com) as the model for inline UI-animation demos.
Avoid scroll-jacking, long intro loaders, and game-style portfolios (e.g. Bruno Simon) that delay
reaching the work.

## Principles

- Lead with the interactive piece; the reasoning follows.
- Label original work honestly as video/render work, and the web piece as a rebuild.
- Focus on the system, not the shot: inputs, parameters, tools.
- Anti-goal: walls of process text, or generic discover/define/deliver templates.
- Until real work exists, gray placeholders and generic faux-UI scenes (`/dev/proto/faux-ui`) hold
  the slots.
