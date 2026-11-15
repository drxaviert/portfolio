import { HomeLayout } from "@/components/home/home-layout";
import { FEATURED_SLUG, getWork } from "@/lib/work";
import "@/components/home/home-entrance.css";

/**
 * The home page runs the shipped Soft focus entrance (split blur): the cards
 * rise and sharpen while the veil clears, starting from the server-rendered
 * markup with no JS in the way. `shipped` adds the veil layer and the
 * one-play-per-document gate — a hard load plays, a client-side return to `/`
 * inside the same tab does not.
 */
export default function Home() {
  const featured = getWork(FEATURED_SLUG);

  return (
    <HomeLayout
      entrance="soft"
      shipped
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
