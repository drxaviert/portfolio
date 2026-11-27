# Daily painting and home layout

Route: `/` (and the same HomeScreen under the `/work*` drawer).

## Layout
- `HomeScreen` and the daily `ArtCard` mount once in `src/app/(site)/layout.tsx`,
  shared by `/` and `/work*`. The layout fetches `getTodaysArt` (cached per UTC day).
- `page.tsx` renders only the edge-blur bands (homepage-only). `work/layout.tsx`
  renders only `WorkDrawer`.
- Navigating `/` <-> `/work*` never remounts the card, carousel or player.

## Card
- Top-right "Today's painting" card: framed image, title, artist, synopsis,
  "View full screen" (dialog).
- Clicking the painting shreds it (Banksy style); clicking again finishes the shred.

## States
- Phases: idle, shredding, shredded, exiting.
- The shred state persists across `/` <-> `/work` open and close. A shred in
  progress keeps animating through navigation.
- Hard load always starts idle. Reduced motion skips the descent.
- Image unavailable shows a note and disables shredding.

## Known gaps
- Player playback across navigation not exercised in browser tests (one audio
  element confirmed, no playback).
