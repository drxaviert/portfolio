import { notFound } from "next/navigation";
import { ArtCard } from "@/components/home/art-card/art-card";
import { VariantGallery } from "./variant-gallery";
import { ART_DATA_VERSION, fallbackArt, getTodaysArt } from "@/lib/daily-art";
import type { DailyArt } from "@/lib/daily-art";
import "./lab.css";

/**
 * Dev lab for the daily painting card.
 *
 * Every sample is pinned to a real AIC id (except the bundled fallback) and
 * rendered at the three sizes the home actually gives the card:
 *
 *   1440 â†’ 849 Ã— 276
 *   1024 â†’ 728 Ã— 220
 *    375 â†’ 171 Ã— 160
 *
 * That covers portrait, landscape, square, panorama and hanging-scroll
 * aspects, plus the four dated frame eras. AIC's public-domain set currently
 * has no post-1945 paintings, so the modern frame sample forces a 1960 date
 * and says so in its caption; the image is still a real AIC work.
 */
export const metadata = {
  title: "Daily painting card lab",
  robots: { index: false, follow: false },
};

type LabSample = {
  key: string;
  caption: string;
  note?: string;
  /** Lab-only AIC dominant colour, used by the painting-tint variant. */
  accent?: string;
  art: DailyArt;
};

const CARD_SIZES = [
  { label: "1440 Â· 849 Ã— 276", width: 849, height: 276 },
  { label: "1024 Â· 728 Ã— 220", width: 728, height: 220 },
  { label: "375 Â· 171 Ã— 160", width: 171, height: 160 },
] as const;

function baseArt(
  fields: Omit<DailyArt, "articUrl" | "fallback" | "date">,
  date: string,
): DailyArt {
  return {
    ...fields,
    date,
    articUrl: fields.id ? `https://www.artic.edu/artworks/${fields.id}` : null,
    fallback: false,
  };
}

function samples(today: string): LabSample[] {
  const common = {
    lqip: null,
  };

  return [
    {
      key: "portrait-ornate",
      accent: "hsl(39 14% 53%)",
      caption:
        "Portrait Â· 0.79 Â· pre-1700 ornate gilt Â· The Music Lesson, 1665",
      art: baseArt(
        {
          id: 512,
          title: "The Music Lesson",
          artist: "Gerard ter Borch the Younger",
          dateDisplay: "c. 1670",
          dateStart: 1665,
          placeOfOrigin: "Netherlands",
          styleTitle: "17th Century",
          medium: "Oil on canvas",
          synopsis:
            "A woman plays the double-headed lute while her companion marks the tempo. The intimate interior and the bed behind them leave the precise relationship tantalizingly ambiguous.",
          imageId: "d55ad474-aa3c-6881-b10d-06a9ac6e05b7",
          width: 6218,
          height: 7855,
          alt: "A work made of oil on canvas.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "landscape-carved",
      caption:
        "Landscape Â· 1.70 Â· 1700â€“1880 carved gilt Â· John Thomlinson and His Family, 1745",
      art: baseArt(
        {
          id: 2169,
          title: "John Thomlinson and His Family",
          artist: "Arthur Devis",
          dateDisplay: "1745",
          dateStart: 1745,
          placeOfOrigin: "England",
          styleTitle: "18th Century",
          medium: "Oil on canvas",
          synopsis: "Oil on canvas, painted in England, 1745 â€” 18th Century.",
          imageId: "e8a4e4ed-13cf-901a-adc9-4a0e9bc47424",
          width: 3000,
          height: 1767,
          alt: "A work made of oil on canvas.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "square-walnut",
      caption: "Square Â· 1.00 Â· 1880â€“1945 walnut Â· Irises, 1914",
      art: baseArt(
        {
          id: 4887,
          title: "Irises",
          artist: "Claude Monet",
          dateDisplay: "1914-17",
          dateStart: 1914,
          placeOfOrigin: "France",
          styleTitle: "Impressionism",
          medium: "Oil on canvas",
          synopsis:
            "Irises is one of a series of paintings Monet undertook during World War I, experimenting with familiar motifs on an ever-expanding scale. Lacking a horizon, the viewer is both on top of and submerged in its encrusted surface.",
          imageId: "1f925e43-ff81-5ad7-da75-b28ea651c09f",
          width: 5407,
          height: 5398,
          alt: "A work made of oil on canvas.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "landscape-walnut",
      accent: "hsl(59 12% 52%)",
      caption:
        "Landscape Â· 1.49 Â· 1880â€“1945 walnut Â· A Sunday on La Grande Jatte, 1884",
      art: baseArt(
        {
          id: 27992,
          title: "A Sunday on La Grande Jatte - 1884",
          artist: "Georges Seurat",
          dateDisplay: "1884-86",
          dateStart: 1884,
          placeOfOrigin: "France",
          styleTitle: "Pointillism",
          medium: "Oil on canvas",
          synopsis:
            "Seurat depicted Parisians strolling, lounging, sailing and fishing in La Grande Jatte on the River Seine. He used Pointillism, applying tiny dabs of colour that viewers see as a single brilliant hue.",
          imageId: "2d484387-2509-5e8e-2c43-22f9981972eb",
          width: 9310,
          height: 6237,
          alt: "Large painting of people in a crowded park, brushstrokes are dots.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "panorama",
      caption:
        "Panorama Â· 3.04 Â· pre-1700 gilt Â· Landscape of the Four Seasons, c. 1560",
      art: baseArt(
        {
          id: 7634,
          title: "Landscape of the Four Seasons",
          artist: "Sesson Shukei",
          dateDisplay: "About 1560",
          dateStart: 1501,
          placeOfOrigin: "Japan",
          styleTitle: "Japanese (culture or style)",
          medium: "Pair of six-panel screens; ink and light color on paper",
          synopsis:
            "Sesson Shukei was a Zen Buddhist monk-painter who worked in eastern Japan without ever reaching Kyoto. His dreamlike Chinese landscape expands in spatial depth, with the seasons flowing from right to left.",
          imageId: "58d58cdf-ed3d-c641-1910-504ae64b8ce8",
          width: 3000,
          height: 987,
          alt: "A work made of pair of six-panel screens; ink and light color on paper.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "scroll",
      caption:
        "Hanging scroll Â· 0.41 Â· silk mount Â· Beauty Beneath a Willow Tree, c. 1780",
      art: baseArt(
        {
          id: 8900,
          title: "Beauty Beneath a Willow Tree",
          artist: "Isoda Koryusai",
          dateDisplay: "Edo period, c. 1780",
          dateStart: 1775,
          placeOfOrigin: "Japan",
          styleTitle: "Japanese (culture or style)",
          medium: "Hanging scroll; ink on silk",
          synopsis:
            "A young woman strolls beneath a willow tree, lost in thought. Her black kimono, layered reds and phoenix-embroidered obi suggest she is on the way to an engagement.",
          imageId: "5708fdd8-40e3-3c68-41bb-454684981dc5",
          width: 924,
          height: 2250,
          alt: "A work made of hanging scroll; ink on silk.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "portrait-walnut",
      caption:
        "Tall portrait Â· 0.53 Â· 1880â€“1945 walnut Â· Mrs. George Swinton, 1897",
      art: baseArt(
        {
          id: 4749,
          title: "Mrs. George Swinton (Elizabeth Ebsworth)",
          artist: "John Singer Sargent",
          dateDisplay: "1897",
          dateStart: 1897,
          placeOfOrigin: "London",
          styleTitle: "Impressionism",
          medium: "Oil on canvas",
          synopsis:
            "Sargent was one of the most fashionable portraitists of the late 19th century. Here he harmonized the realism of his sitter's face with impressionistic brushstrokes describing her shimmering gown.",
          imageId: "074c1b1b-fe92-01ce-9e62-cc99369142dd",
          width: 3330,
          height: 6269,
          alt: "A work made of oil on canvas.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "modern",
      caption: "Square Â· post-1945 thin black float Â· Irises (frame study)",
      note: "The date is forced to 1960 so this sample reaches the post-1945 frame; AIC has no CC0 paintings dated after 1945.",
      art: baseArt(
        {
          id: 4887,
          title: "Irises",
          artist: "Claude Monet",
          dateDisplay: "1914-17 Â· frame study",
          dateStart: 1960,
          placeOfOrigin: "France",
          styleTitle: "Impressionism",
          medium: "Oil on canvas",
          synopsis:
            "Monet's late Irises experiments with scale and a horizonless surface. This sample forces the post-1945 frame so the modern face can be compared.",
          imageId: "1f925e43-ff81-5ad7-da75-b28ea651c09f",
          width: 5407,
          height: 5398,
          alt: "A work made of oil on canvas.",
          ...common,
        },
        today,
      ),
    },
    {
      key: "fallback",
      caption: "Bundled stand-in Â· API unavailable Â· 4:3",
      note: "No AIC request or image: this is the card's fallback painting.",
      art: fallbackArt(today),
    },
  ];
}

export default async function ArtCardLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const todayArt = await getTodaysArt(ART_DATA_VERSION);
  const today = todayArt.date;
  const items = samples(today);
  const portrait = items.find((item) => item.key === "portrait-ornate");
  const landscape = items.find((item) => item.key === "landscape-walnut");

  return (
    <main className="art-lab">
      <header className="art-lab-header">
        <p className="art-lab-kicker">Dev lab Â· not shipped</p>
        <h1 className="art-lab-title">Daily painting card</h1>
        <p className="art-lab-lede">
          Every pinned artwork at the three sizes the home gives the card. The
          wall label sits left, the frame right; the frame takes its aspect from
          the source painting and the text column clamps first at 160px.
        </p>
        <p className="art-lab-note">
          Artwork metadata is fixed by AIC id; image bytes still come from the
          Art Institute&apos;s IIIF service. The modern frame is forced with a
          1960 date because the public-domain set has no post-1945 paintings.
        </p>
      </header>

      <VariantGallery
        today={todayArt}
        portrait={portrait?.art ?? todayArt}
        portraitAccent={portrait?.accent}
        landscape={landscape?.art ?? todayArt}
        landscapeAccent={landscape?.accent}
      />

      {items.map((sample) => (
        <section className="art-lab-sample" key={sample.key}>
          <div className="art-lab-caption">
            <h2 className="art-lab-sample-title">{sample.art.title}</h2>
            <p className="art-lab-caption-line">{sample.caption}</p>
            {sample.note ? (
              <p className="art-lab-caption-note">{sample.note}</p>
            ) : null}
          </div>

          <div className="art-lab-stages">
            {CARD_SIZES.map((size) => (
              <figure className="art-lab-figure" key={size.label}>
                <figcaption className="art-lab-size">{size.label}</figcaption>
                <div
                  className="art-lab-stage"
                  style={{ width: size.width, height: size.height }}
                >
                  <ArtCard art={sample.art} />
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
