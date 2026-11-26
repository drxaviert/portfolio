import { ArtCard } from "@/components/home/art-card/art-card";
import { NowPlayingCard } from "@/components/home/now-playing-card";
import type { DailyArt } from "@/lib/daily-art";
import "./variant-gallery.css";

/**
 * Plaster preview. Plaster is now the live day-phase treatment on the home
 * card, so this lab keeps only that treatment: the real card inside a local
 * `data-phase="day"` island, beside the live music card. Night, dawn and dusk
 * are deliberately not previewed here; they keep their own phase rules.
 */

const PLASTER = {
  name: "Plaster",
  rationale:
    "Now the live day-phase treatment: gallery white, a hairline shadow and a soft daylight bloom. Night, dawn and dusk keep their phase horizons and orb spotlight.",
  spec: "wall surface-low + 3% horizon · ink on-surface / variant · light white bloom",
};

type Row = {
  id: string;
  label: string;
  meta: string;
  art: DailyArt;
  music?: boolean;
};

type VariantGalleryProps = {
  today: DailyArt;
  portrait: DailyArt;
  landscape: DailyArt;
};

export function VariantGallery({
  today,
  portrait,
  landscape,
}: VariantGalleryProps) {
  const rows: Row[] = [
    {
      id: "today",
      label: "Today's painting",
      meta: `${today.title} · ${today.artist} · 849 × 276`,
      art: today,
      music: true,
    },
    {
      id: "portrait",
      label: "Portrait sample",
      meta: `AIC 512 · ${portrait.title} · 849 × 276`,
      art: portrait,
    },
    {
      id: "landscape",
      label: "Landscape sample",
      meta: `AIC 27992 · ${landscape.title} · 849 × 276`,
      art: landscape,
    },
  ];

  return (
    <section
      className="art-variant-gallery"
      data-phase="day"
      aria-labelledby="art-variant-heading"
    >
      <header className="art-variant-header">
        <p className="art-variant-kicker">Day phase · live treatment</p>
        <h2 className="art-variant-title" id="art-variant-heading">
          Plaster day treatment
        </h2>
        <p className="art-variant-lede">
          Plaster is now the live day-phase wall on the home card. Night, dawn
          and dusk keep their phase horizons and orb spotlight. Each stage is
          the real card inside a local day island, with the live music card as
          the sibling reference; the typography fixes apply to both cards.
        </p>
      </header>

      {rows.map((row) => (
        <section
          className="art-variant-row"
          key={row.id}
          aria-label={`${row.label} Plaster preview`}
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
                    Live reference at 275 × 276; the day wall should read as a
                    sibling surface.
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

            <figure className="art-variant-item">
              <figcaption className="art-variant-caption">
                <h4 className="art-variant-name">{PLASTER.name}</h4>
                <p className="art-variant-rationale">{PLASTER.rationale}</p>
                <p className="art-variant-spec">{PLASTER.spec}</p>
              </figcaption>
              <div className="art-variant-stage">
                <ArtCard art={row.art} />
              </div>
            </figure>
          </div>
        </section>
      ))}
    </section>
  );
}
