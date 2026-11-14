import { HomeLayout } from "@/components/home/home-layout";
import { FEATURED_SLUG, getWork } from "@/lib/work";

export default function Home() {
  const featured = getWork(FEATURED_SLUG);

  return (
    <HomeLayout
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
