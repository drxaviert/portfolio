# Media — as built (2026-11-19)

One manifest per file in `content/media/`. `<Media id="…" />` resolves it on the server, so a bad id
fails the build instead of drawing an empty frame. The ingest side is in
[real-work-intake.md](../workflows/real-work-intake.md#1-media); this page covers how the frame
behaves once it has an id.

## Slots

Every slot accepts a media id instead of its placeholder. A slot passed a `<Media>` child uses that
child instead, and a slot with neither keeps the neutral `div.wd-media` surface.

| Slot | How it takes media | Ratio | Source |
| --- | --- | --- | --- |
| `Figure` | `media="<id>"` or a `<Media>` child | the manifest's | `src/components/work/media-parts.tsx:56-104` |
| `Hero` | the study's frontmatter, `cover: "media:<id>"` | `689 / 352` | `media-parts.tsx:22-54`, `src/components/work/reader.css:385` |
| `StepFigure` | `media="<id>"` or a `<Media>` child | `16 / 9` | `media-parts.tsx:106-120`, `reader.css:842-845` |
| `ContactSheet` | `media="<id>"` or a `<Media>` child | the manifest's, on one frame | `media-parts.tsx:122-149`, `reader.css:944-947` |
| `Cover` | the study's frontmatter, `cover: "media:<id>"` | the slot's box | `src/components/work/cover.tsx:52-89` |
| bare `Media` | `id="<id>"` anywhere in MDX | the manifest's | `src/components/media/media.tsx:25-40` |

`Figure`'s `aspect` prop (default `16 / 9`) sizes only the placeholder that appears when there is no
media; with a manifest the frame takes the picture's own ratio (`media-parts.tsx:58`, `:94`).

`<Hero>` also accepts a `media` id as an MDX prop, but the reader already renders the study's hero
from frontmatter (`src/components/work/reader.tsx:43`), so an MDX `<Hero media>` would add a second
hero box. Use the frontmatter.

A media cover resolves through `coverImageFor` to one picture: the widest AVIF and WebP variant at or
below 1280 (`src/lib/media.ts:215-243`), or a video's poster. The home cards and the carousel pass
that picture through (`src/components/home/home-cards.tsx:84`,
`src/components/home/carousel/home-carousel.tsx:293-297`); the study hero does too
(`src/components/work/reader.tsx:43`). The work index passes only the scene
(`src/components/work/work-grid.tsx:27`, `work-index-list.tsx:31`), so a media cover shows the
neutral surface there today.

## Ratio and fit

`.media` sets its ratio inline from the manifest, `--media-aspect: width / height`, with a `16 / 9`
fallback (`src/components/media/media.css:14`). The picture fills the frame and crops
(`object-fit: cover`), so a slot whose box differs from the manifest crops rather than letterboxes.
The picture's own ratio is therefore the safe default for new slots.

## Images

Images are a `<picture>`, not `next/image`: an AVIF `<source>`, then WebP, then an `<img>` whose
`srcSet` lists every width in the manifest (`src/components/media/media-image.tsx:50-69`). The
browser picks the width, so no request goes through Vercel's optimiser.

- The frame reserves the manifest ratio and the `img` carries `width`/`height`, so there is no
  layout shift.
- The 16px `lqip` is the frame's background image; it is already there before the file arrives, with
  no script to fade it (`media-image.tsx:40-49`).
- `sizes` defaults to `(min-width: 768px) 560px, 100vw` (`media-image.tsx:19`). The wide `Figure`
  passes `880px`; the `Hero` media path passes `582px` (`media-parts.tsx:39-41`, `:84-89`).
- `priority` switches loading to `eager` and `fetchPriority` to `high`; everything else lazy-loads
  (`media-image.tsx:65-66`).

## Video and autoplay policy

The clip is `muted`, `loop`, `playsInline`, `preload="none"`, with the poster set
(`src/components/media/media-video.tsx:99-109`).

| State | Behaviour |
| --- | --- |
| On screen | plays once 25% of the frame is visible (`media-video.tsx:49-56`) |
| Off screen | pauses; the observer's callback covers entry and exit |
| Hidden tab | pauses via `visibilitychange` (`media-video.tsx:59-64`) |
| Autoplay refused | the poster stays; the rejection is caught (`media-video.tsx:39-42`) |
| `prefers-reduced-motion: reduce` | never starts itself; the poster stays and a 44px button is the only way in (`media-video.tsx:112-134`) |

The reduced-motion button is 44px with a `2px var(--primary)` focus ring at `3px` offset
(`media.css:35-56`). Its label switches between `Play video` and `Pause video`
(`media-video.tsx:116`). The intent is that motion never starts on its own for a reader who asked
for less of it.

Poster: `<video poster>` always uses `poster.jpg`. `poster.avif` exists for the cover path. There is
no fade from poster to first frame.

## Alt text

- The manifest requires an `alt` string. `pnpm post` prompts for it, or takes `--alt` on a
  single-file run; a non-TTY run without `--alt` leaves it empty.
- `<Media alt="…">` overrides the manifest; `alt=""` marks the frame decorative
  (`media.tsx:19-26`).
- A video has no `alt` attribute: the string becomes `aria-label`, and an empty string omits it
  (`media-video.tsx:104`).
- A `Figure` caption is separate. It does not replace alt text, and alt should describe the frame,
  not repeat the caption.
- The hero wrapper is `aria-hidden="true"` (`media-parts.tsx:49`), so a hero picture's alt is never
  announced. Treat the cover as decorative.

## Audio

Audio is stripped at ingest unless `pnpm post` ran with `--audio`; the manifest records the result in
`hasAudio` (`scripts/post.ts:491`, `:617`). Playback is always muted and there are no controls, so a
clip's audio is never heard through `<Media>` today. An audible clip needs a component decision, not
just a manifest flag.

## What fails the build

`getMedia` throws on:

- an id that does not match `^[a-z0-9][a-z0-9-]*$` (`src/lib/media.ts:34`, `:186-190`);
- no `content/media/<id>.json` (`media.ts:194-198`);
- a manifest that does not validate: id mismatch, unknown `kind`, non-integer or non-positive
  dimensions, non-`https` media URLs, empty `sources`, a `lqip` that is not an image data URI, a
  non-positive `duration`, or a non-boolean `hasAudio` (`media.ts:118-180`);
- an image manifest with no sources to draw (`media-image.tsx:33-37`).

Manifests are read once per id per process (`media.ts:43`, `:182-212`), so a newly posted file needs
a dev-server restart before a page can use it.

## Feed

`pnpm post --post` writes `content/posts/<date>-<slug>.mdx`, and `/play` renders those files:
title, date, summary and media, newest first, in one static list
(`src/lib/posts.ts`, `src/app/play/page.tsx`). Entries have no body and no per-post route yet, and
the route is a plain placeholder pending its design pass. The frontmatter is `title` (or the
`caption` the script writes), `date`, `summary` and `media: ["<id>", ...]`; a missing field or a
bad media id fails the build.
