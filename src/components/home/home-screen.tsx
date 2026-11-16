import type { CarouselItem } from "@/components/home/carousel/home-carousel";
import { HomeLayout } from "@/components/home/home-layout";
import { FEATURED_SLUG, getWork, listWork } from "@/lib/work";
import "@/components/home/home-entrance.css";

/**
 * The homepage, server-rendered. `/` renders it as the page; a direct load of a
 * study renders it underneath the reader, so closing that reader has a card to
 * fly into exactly as it does after a soft navigation.
 *
 * It runs the shipped Soft focus entrance (split blur): the cards rise and
 * sharpen while the veil clears, starting from the server-rendered markup with
 * no JS in the way. `shipped` adds the veil layer and the one-play-per-document
 * gate — a hard load of `/` plays, a client-side arrival does not, and the
 * reader marks the document before it closes so the copy behind it is resting.
 */
export function HomeScreen() {
  const featured = getWork(FEATURED_SLUG);

  // The featured study leads; the rest keep reading order. The placeholder
  // closes the row until there is more to show.
  const works = listWork().sort(
    (a, b) =>
      Number(b.slug === FEATURED_SLUG) - Number(a.slug === FEATURED_SLUG),
  );
  const items: CarouselItem[] = [
    ...works.map((work) => ({
      kind: "work" as const,
      slug: work.slug,
      title: work.title,
      cover: work.cover,
    })),
    { kind: "placeholder", title: "More work soon" },
  ];

  return (
    <HomeLayout
      entrance="soft"
      shipped
      items={items}
      featured={
        featured
          ? {
              slug: featured.slug,
              title: featured.title,
              cover: featured.cover,
            }
          : undefined
      }
    />
  );
}
