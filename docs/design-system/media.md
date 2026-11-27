# Media Ã¢â‚¬â€ as built (2026-11-19)

One manifest per file in `content/media/`. `<Media id="Ã¢â‚¬Â¦" />` resolves it on the server, so a bad id
fails the build instead of drawing an empty frame. The ingest side is in
[real-work-intake.md](../workflows/real-work-intake.md#1-media); this page covers how the frame
behaves once it has an id.

## Browsing, uploading and publishing

`/dev/media` lists every manifest in `content/media` and nothing else, so the `<Media id="...">` you
copy is one that resolves. It runs under `pnpm dev` only and 404s in a production build. A card shows
the smallest image variant (or the video poster, never a playing video), the dimensions, duration,
recorded bytes and createdAt, with Copy tag and Copy id buttons and a filter/search over the list.

The page is also the ingest path: drop files anywhere, or press Upload files. Each drop is staged
with a caption, a with-audio toggle and HLS auto/force/off for video, then `POST /dev/media/api/upload`
streams the file into `media/inbox/` and a one-at-a-time queue runs `scripts/post.ts --only` on it.
Progress is polled from `/dev/media/api/jobs` (queued, encoding, uploading, done or the encoder's own
error), a done job refreshes the page, and a failure stays in the inbox for a retry.

The header counts manifests that are untracked or modified in git. Publish commits exactly those
paths and pushes `main`; it refuses unless the branch is `main` and every dirty path is under
`content/media/`, so work in progress never rides along. Byte counts are the ones the manifest
records, so an image card says "not recorded" instead of guessing.

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
below 1280 (`src/lib/media.ts:268-292`), or a video's poster. The home cards and the carousel pass
that picture through (`src/components/home/home-cards.tsx:84`,
`src/components/home/carousel/home-carousel.tsx:293-297`); the study hero does too
(`src/components/work/reader.tsx:43`). The work index's hover thumbnail passes the scene and the
resolved picture too (`src/components/work/work-list.tsx`), so a media cover shows there as well.

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
(`src/components/media/media-video.tsx:161-178`).

| State | Behaviour |
| --- | --- |
| On screen | plays once 25% of the frame is visible (`media-video.tsx:61-67`) |
| Off screen | pauses; the observer's callback covers entry and exit |
| Hidden tab | pauses via `visibilitychange` (`media-video.tsx:74-80`) |
| Autoplay refused | the poster stays; the rejection is caught (`media-video.tsx:51-54`) |
| `prefers-reduced-motion: reduce` | never starts itself; the poster stays and a 44px button is the only way in (`media-video.tsx:180-202`) |

The reduced-motion button is 44px with a `2px var(--primary)` focus ring at `3px` offset
(`media.css:35-56`). Its label switches between `Play video` and `Pause video`
(`media-video.tsx:184`). The intent is that motion never starts on its own for a reader who asked
for less of it.

Poster: `<video poster>` always uses `poster.jpg`. `poster.avif` exists for the cover path. There is
no fade from poster to first frame.

## Adaptive streaming (HLS)

A clip **longer than 20 s** is encoded as an adaptive ladder instead of one MP4 (`shouldUseHls`
in `scripts/post.ts`). `--hls` forces a ladder on a shorter clip, `--no-hls` keeps a single MP4
on a longer one; 20 s exactly still counts as short.

| Piece | Value |
| --- | --- |
| Ladder | 1080p `5000k`/`10000k`, 720p `2800k`/`5600k`, 480p `1200k`/`2400k` (maxrate/bufsize) |
| Rungs kept | those at or under the source height, so nothing is upscaled; under 480 the single rung is the source height, even-floored |
| Encode | one ffmpeg run: `split` Ã¢â€ â€™ per-rung `scale=Ã¢â‚¬Â¦:flags=lanczos,setsar=1`, libx264 `-crf 21 -preset slow -pix_fmt yuv420p` |
| Keyframes | `-force_key_frames "expr:gte(t,n_forced*2)" -sc_threshold 0`, so every segment starts on one |
| Segments | `-hls_time 4`, `fmp4`, `independent_segments`, `-hls_playlist_type vod` |
| Output | `master.m3u8`, then `v<rung>/index.m3u8`, `v<rung>/init_<rung>.mp4`, `v<rung>/segment_<n>.m4s` |
| Upload | `media/<id>/hls/<relative path>`, six at a time; `.m3u8` is `application/vnd.apple.mpegurl`, `.ts` is `video/mp2t`, `.m4s` is `video/iso.segment`, `.mp4` is `video/mp4`; R2, one-year immutable cache |
| Budget | warn over 60 MB, hard-fail over 150 MB, both before any upload |
| Manifest | `hls: { url, bytes, levels: [{ height, bandwidth }] }`; `levels` is read back from the master's `EXT-X-STREAM-INF` |

The manifest's required `mp4` stays: for an HLS clip it is a progressive encode at the **lowest
rung** with `+faststart`, so a browser with neither native HLS nor MSE still has a playable file.
The 10 MB MP4 cap applies to non-HLS clips only; the ladder has its own budget.

Playback (`src/components/media/media-video.tsx`):

- A clip with `hls` never autoplays and never loops. It shows the poster and native `controls`
  (keyboard reachable), keeps `playsInline`, and is muted only when `hasAudio` is false.
- The library is fetched only after the IntersectionObserver first reports the frame at 25%:
  `hls.js/dist/hls.light.mjs`, pinned to `1.7.4`. A page of short loops never requests it.
- Path order follows the hls.js README: `Hls.isSupported()` first (MSE or ManagedMediaSource, so
  iOS 17.1+ included), then native `video.src` when `canPlayType` is non-empty (older iOS), then the
  mp4 `<source>`. `canPlayType` is not trusted on its own — Safari answers `"maybe"` and so does
  Chrome, which cannot demux HLS. Because `Hls.isSupported()` needs the import, the player first
  checks for `window.MediaSource` / `ManagedMediaSource` and skips the fetch when neither exists.
  `hls.destroy()` runs on unmount.
- Short loops are unchanged: muted, looping, autoplaying in view, and the reduced-motion button
  is still the only way in under `prefers-reduced-motion: reduce`.

## Canvas rendition

The WebGL grid draws its planes at roughly 111-197px, so a 1080p frame is wasted decode and
texture upload. When the main MP4 is taller than 480px, `pnpm post` also encodes `canvas.mp4`:
H.264, no audio, at most 480px tall, `-crf 24 -maxrate 650k -bufsize 1300k`, `+faststart`, uploaded
as `media/<id>/canvas.mp4` and recorded as `canvas: { url, bytes }` next to `mp4`.

- The canvas uses `canvas ?? mp4` (`src/components/canvas/infinite-canvas.tsx`).
- The live `/work/motion-and-stills` study uses the same list as the dev prototype. An HLS piece has no `canvas` rendition, so its grid plane uses the progressive MP4 while the full-screen viewer uses the ladder.
- Clips already at or below 480p skip the extra encode, so the field is optional and absent for
  them; `validateManifest` accepts both shapes.
- The 16 existing clips over 480p were backfilled from `media/archive/<id>.webm`; only the new
  `canvas.mp4` files were uploaded. The archives themselves were not modified.

## Storage: R2 and local dev

`pnpm post` uploads to Cloudflare R2 over the S3 API (`@aws-sdk/client-s3`,
region `auto`, endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`). The
object key layout is unchanged: `media/<id>/...`. `R2_PUBLIC_BASE_URL` turns a
key into the public URL. Every upload sets the mapped content type and
`Cache-Control: public, max-age=31536000, immutable`.

The `<id>` prefix is content-addressed (`<slug>-sha256(original)[:10]`); the
individual file names are not hashes. Re-running the pipeline for the same
original writes the same keys, which is why the immutable cache is safe.

Credentials live in `.env.r2` (gitignored): `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
A missing key is named in the error; values are never printed. See
`.env.r2.example`. `next.config.ts` hard-codes the public r2.dev host, so
production needs no `.env.r2` or R2 env var; `R2_PUBLIC_BASE_URL` remains an
optional override for a custom domain. The Blob host is gone now that every
rendered manifest points at R2. The former test fixtures that had no local
original were removed once they became the last Blob URLs.

### Migration

`pnpm media:migrate-r2 --dry-run --archive media/archive --archive ...` prints
the per-manifest plan without a network call. Drop `--dry-run` to re-encode the
local originals, upload, HEAD-skip objects already in R2 and rewrite the
manifests. A manifest with no local original is listed as missing and skipped.
Blob is never read.

### Local media

Browser, playback and performance tests must not pull production storage. Set
`MEDIA_ORIGIN=local`, populate `media/local/` with `pnpm post --local` (or the
migration's `--local` flag, which mirrors the R2 uploads), and start the dev
server. `src/lib/media.ts` rewrites every manifest URL to
`/media/local/<key>`; the dev-only `src/app/media/local/[...key]/route.ts`
serves the file with the same content type and byte ranges. The manifest still
records the production R2 URL.

## Alt text

- The manifest requires an `alt` string. `pnpm post` prompts for it, or takes `--alt` on a
  single-file run; a non-TTY run without `--alt` leaves it empty.
- `<Media alt="Ã¢â‚¬Â¦">` overrides the manifest; `alt=""` marks the frame decorative
  (`media.tsx:19-26`).
- A video has no `alt` attribute: the string becomes `aria-label`, and an empty string omits it
  (`media-video.tsx:172`).
- A `Figure` caption is separate. It does not replace alt text, and alt should describe the frame,
  not repeat the caption.
- The hero wrapper is `aria-hidden="true"` (`media-parts.tsx:49`), so a hero picture's alt is never
  announced. Treat the cover as decorative.

## Audio

Audio is stripped at ingest unless `pnpm post` ran with `--audio`; the manifest records the result in
`hasAudio` (`scripts/post.ts:781`, `:951`). A short loop is always muted and has no controls, so its
audio is never heard through `<Media>` today. An HLS clip is the exception: it plays through native
controls and is unmuted when it has audio (see Adaptive streaming above). Everything else needs a
component decision, not just a manifest flag.

## Audio tracks (self-hosted)

The now-playing track can play from a file instead of the YouTube embed.

- Ingest: drop an `.mp3`, `.m4a` or `.ogg` in `media/inbox/` and run
  `pnpm post --only <file>` (add `--local` for `media/local/`). The file is stored as supplied at
  `media/<id>/audio.<ext>` (content types `audio/mpeg`, `audio/mp4`, `audio/ogg`), with the usual
  one-year immutable cache on R2. There is no manifest; the command prints the key. Locally the file
  lands at `media/local/media/<id>/audio.<ext>`. The original is archived, never deleted.
- Wiring: `NOW_PLAYING_TRACK.audioKey` in `src/components/home/now-playing-track.ts`. The player
  uses the audio backend when `audioUrlFor(track)` returns a URL, otherwise YouTube.
  `NEXT_PUBLIC_MEDIA_BASE` (set in `next.config.ts`) is `/media/local` under `MEDIA_ORIGIN=local` and
  empty otherwise, so production stays on YouTube until the object is in R2 and the base is pointed at
  the R2 host.
- **R2 CORS requirement.** The element is created with `crossOrigin="anonymous"` and feeds a Web
  Audio `AnalyserNode` (`src/components/player/audio-bands.ts`). A cross-origin file served without
  CORS headers is muted by `createMediaElementSource` and reads as zeros. Before switching
  production to the R2 URL, add a CORS rule on the bucket: allowed methods `GET` and `HEAD`, allowed
  origins the production site origin(s) (and `http://localhost:3000` for dev if wanted), allowed
  header `Range`, expose `Content-Length`, `Content-Range` and `Accept-Ranges`. The bucket has not
  been changed.
- Bands: `audioBands.getBands()` returns smoothed 0..1 `bass` (20-250 Hz), `mid` (250 Hz-2 kHz),
  `high` (2-12 kHz) and `energy`, all 0 when nothing plays. Under `prefers-reduced-motion` the four
  collapse to one slow energy value capped at 0.5. `?tune=1` shows the four as read-only bars.

## What fails the build

`getMedia` throws on:

- an id that does not match `^[a-z0-9][a-z0-9-]*$` (`src/lib/media.ts:41`, `:227-231`);
- no `content/media/<id>.json` (`media.ts:235-239`);
- a manifest that does not validate: id mismatch, unknown `kind`, non-integer or non-positive
  dimensions, non-`https` media URLs, empty `sources`, a `lqip` that is not an image data URI, a
  non-positive `duration`, a non-boolean `hasAudio`, an `hls` block whose `url` is not an https
  `.m3u8`, whose `bytes` is not a positive integer, or whose `levels` are empty or not positive
  (`media.ts:122-155`, `:157-221`), or a `canvas` block with a non-https url or non-positive bytes;
- an image manifest with no sources to draw (`media-image.tsx:33-37`).

Manifests are read once per id per process (`media.ts:50`, `:223-253`), so a newly posted file needs
a dev-server restart before a page can use it.

## Feed

`pnpm post --post` writes `content/posts/<date>-<slug>.mdx`, but no route renders those files yet.
The standalone feed is pending its design pass.
