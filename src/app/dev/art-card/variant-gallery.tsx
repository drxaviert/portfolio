import { ArtCard } from "@/components/home/art-card/art-card";
import { NowPlayingCard } from "@/components/home/now-playing-card";
import type { DailyArt } from "@/lib/daily-art";
import "./variant-gallery.css";

/**
 * Surface comparison. Plaster is live in the day phase; the standard variant is
 * the plain ring-host fill the other home cards use. Both are shown in the day
 * and night palettes. The live card owns the wall, ink, spotlight and type; the
 * standard stage only removes the wall, vignette and spotlight.
 */

const STANDARD = {
  name: "Standard surface",
  rationale:
    "The plain ring-host fill the other home cards use: no custom wall, tint or vignette, normal on-surface ink, and the spotlight off.",
  spec: "bg-surface-container-low · on-surface ink · no spotlight",
};

const PHASES = [
  {
    id: "day",
    label: "Day phase",
    note: "Plaster is the live day treatment. The standard surface sits beside it on the same plain ring fill.",
    liveName: "Plaster (live)",
    liveRationale: "The live day wall and soft white daylight bloom.",
    liveSpec:
      "wall surface-low + 3% horizon · ink on-surface / variant · white daylight bloom",
    liveClass: "",
  },
  {
    id: "night",
    label: "Night phase",
    note: "Night keeps the existing phase treatment. Plaster is day-only, so the live reference here is the night wall and orb spotlight.",
    liveName: "Live night",
    liveRationale:
      "The live night wall and orb spotlight; the card layout is the same Plaster layout.",
    liveSpec:
      "wall surface-low + 9% horizon · ink on-surface / variant · orb spotlight",
    liveClass: "art-card--live-night",
  },
] as const;

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
        <p className="art-variant-kicker">Surface comparison · lab only</p>
        <h2 className="art-variant-title" id="art-variant-heading">
          Plaster vs the standard surface
        </h2>
        <p className="art-variant-lede">
          Plaster stays live in the day phase. The standard variant is the plain
          ring-host fill the other home cards use: no custom wall, tint or
          vignette, normal on-surface ink, and no spotlight. Each phase panel
          shows the live treatment beside the standard surface for today&apos;s
          painting, portrait AIC 512 and landscape AIC 27992.
        </p>
      </header>

      {PHASES.map((phase) => (
        <section
          className="art-variant-phase-panel"
          data-phase={phase.id}
          id={`art-variant-${phase.id}`}
          key={phase.id}
          aria-labelledby={`art-variant-${phase.id}-heading`}
        >
          <header className="art-variant-phase-head">
            <h3
              className="art-variant-phase-title"
              id={`art-variant-${phase.id}-heading`}
            >
              {phase.label}
            </h3>
            <p className="art-variant-phase-note">{phase.note}</p>
          </header>

          {rows.map((row) => (
            <section
              className="art-variant-row"
              key={`${phase.id}-${row.id}`}
              aria-label={`${row.label} ${phase.label} comparison`}
            >
              <div className="art-variant-row-head">
                <h4 className="art-variant-row-title">{row.label}</h4>
                <p className="art-variant-row-meta">{row.meta}</p>
              </div>

              <div className="art-variant-scroller">
                {row.music ? (
                  <figure className="art-variant-item art-variant-item--music">
                    <figcaption className="art-variant-caption">
                      <h5 className="art-variant-name">Music card</h5>
                      <p className="art-variant-rationale">
                        Live reference at 275 × 276; both surfaces should read
                        as siblings.
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
                    <h5 className="art-variant-name">{phase.liveName}</h5>
                    <p className="art-variant-rationale">
                      {phase.liveRationale}
                    </p>
                    <p className="art-variant-spec">{phase.liveSpec}</p>
                  </figcaption>
                  <div
                    className={`art-variant-stage ${phase.liveClass}`.trim()}
                  >
                    <ArtCard art={row.art} />
                  </div>
                </figure>

                <figure className="art-variant-item">
                  <figcaption className="art-variant-caption">
                    <h5 className="art-variant-name">{STANDARD.name}</h5>
                    <p className="art-variant-rationale">
                      {STANDARD.rationale}
                    </p>
                    <p className="art-variant-spec">{STANDARD.spec}</p>
                  </figcaption>
                  <div className="art-variant-stage art-card--standard-surface">
                    <ArtCard art={row.art} />
                  </div>
                </figure>
              </div>
            </section>
          ))}
        </section>
      ))}
    </section>
  );
}
