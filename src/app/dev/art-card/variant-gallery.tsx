import type { CSSProperties } from "react";
import { ArtCard } from "@/components/home/art-card/art-card";
import { NowPlayingCard } from "@/components/home/now-playing-card";
import type { DailyArt } from "@/lib/daily-art";
import "./variant-gallery.css";

/**
 * Day-phase wall treatments for Dat to compare. Lab only: the live card keeps
 * whatever treatment ships on the home page. Every stage renders the real
 * ArtCard inside a local `data-phase="day"` island, so the variants read in the
 * day palette even while the site itself is in another phase.
 */

type Variant = {
  id: string;
  name: string;
  rationale: string;
  spec: string;
};

/**
 * Lab-only accent for today's AIC painting, sampled from the gold ground and
 * red robes in The Crucifixion. Painting colours are not phase tokens, so this
 * stays local to the variant lab and never reaches the live card.
 */
const TODAY_ACCENT = "hsl(38 34% 48%)";

const VARIANTS: Variant[] = [
  {
    id: "plaster",
    name: "Plaster",
    rationale:
      "Gallery white with a hairline edge and a soft daylight bloom. The quietest option; it lets the frame and the painting carry the card.",
    spec: "wall surface-low + 3% horizon · ink on-surface / variant · light white bloom",
  },
  {
    id: "paper",
    name: "Paper",
    rationale:
      "Warm cream with a mounted-sheet hairline. Picks up the music card's warm cover art without going yellow.",
    spec: "wall surface-low + 18% play-glow · ink on-surface, warm secondary · light play-glow wash",
  },
  {
    id: "tint",
    name: "Painting tint",
    rationale:
      "Twelve percent of the painting's dominant colour inside the day surface, with the same hue in the kicker rule and spotlight. A bridge to the artwork that still reads as day.",
    spec: "wall surface-low + 12% artwork accent · ink on-surface, accent-tinted kicker · light accent glow",
  },
  {
    id: "quiet",
    name: "Quiet horizon",
    rationale:
      "The current day horizon at half strength, with a larger and softer light. Keeps the phase cue without the blue cast.",
    spec: "wall surface-low + 4% radial / 7% bottom horizon · ink on-surface / variant · light orb at 8%",
  },
  {
    id: "bold",
    name: "Bold plate",
    rationale:
      "A full day horizon with a translucent label plate and a stronger orb light. The most graphic; the plate holds AA over the busiest wall.",
    spec: "wall surface-container + 18–24% horizon · ink primary kicker, on-surface body · light orb at 24%",
  },
];

type Row = {
  id: string;
  label: string;
  meta: string;
  art: DailyArt;
  accent?: string;
  music?: boolean;
};

type VariantGalleryProps = {
  today: DailyArt;
  portrait: DailyArt;
  portraitAccent?: string;
  landscape: DailyArt;
  landscapeAccent?: string;
};

export function VariantGallery({
  today,
  portrait,
  portraitAccent,
  landscape,
  landscapeAccent,
}: VariantGalleryProps) {
  const rows: Row[] = [
    {
      id: "today",
      label: "Today's painting",
      meta: `${today.title} · ${today.artist} · 849 × 276`,
      art: today,
      accent: TODAY_ACCENT,
      music: true,
    },
    {
      id: "portrait",
      label: "Portrait sample",
      meta: `AIC 512 · ${portrait.title} · 849 × 276`,
      art: portrait,
      accent: portraitAccent,
    },
    {
      id: "landscape",
      label: "Landscape sample",
      meta: `AIC 27992 · ${landscape.title} · 849 × 276`,
      art: landscape,
      accent: landscapeAccent,
    },
  ];

  return (
    <section
      className="art-variant-gallery"
      data-phase="day"
      aria-labelledby="art-variant-heading"
    >
      <header className="art-variant-header">
        <p className="art-variant-kicker">Day phase · lab only</p>
        <h2 className="art-variant-title" id="art-variant-heading">
          Five day-phase wall treatments
        </h2>
        <p className="art-variant-lede">
          The home card is untouched. Each stage is the real card forced into
          the day palette, with the artwork and frame unchanged, so wall, label
          ink and spotlight are the only variables. Scroll sideways to compare.
          The live music card stays at the start of the first row as the harmony
          reference, and every spotlight is shown at rest.
        </p>
      </header>

      {rows.map((row) => (
        <section
          className="art-variant-row"
          key={row.id}
          aria-label={`${row.label} variants`}
        >
          <div className="art-variant-row-head">
            <h3 className="art-variant-row-title">{row.label}</h3>
            <p className="art-variant-row-meta">{row.meta}</p>
          </div>

          <div className="art-variant-scroller">
            {row.music ? (
              <figure className="art-variant-item art-variant-item--music">
                <figcaption className="art-variant-caption">
                  <h4 className="art-variant-name">Music card</h4>
                  <p className="art-variant-rationale">
                    Live reference at 275 × 276; the day variants should read as
                    a sibling surface.
                  </p>
                  <p className="art-variant-spec">
                    surface-low · on-surface ink · orb-gradient controls
                  </p>
                </figcaption>
                <div className="art-variant-stage art-variant-stage--music">
                  <NowPlayingCard />
                </div>
              </figure>
            ) : null}

            {VARIANTS.map((variant) => (
              <figure
                className={`art-variant-item art-variant art-variant-${variant.id}`}
                key={variant.id}
                style={
                  row.accent
                    ? ({ "--variant-accent": row.accent } as CSSProperties)
                    : undefined
                }
              >
                <figcaption className="art-variant-caption">
                  <h4 className="art-variant-name">{variant.name}</h4>
                  <p className="art-variant-rationale">{variant.rationale}</p>
                  <p className="art-variant-spec">{variant.spec}</p>
                </figcaption>
                <div className="art-variant-stage">
                  <ArtCard art={row.art} />
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
