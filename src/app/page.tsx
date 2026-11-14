import type { CarouselItem } from "@/components/home/carousel/home-carousel";
import { HomeLayout } from "@/components/home/home-layout";
import { FEATURED_SLUG, listWork } from "@/lib/work";

export default function Home() {
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

  return <HomeLayout items={items} />;
}
