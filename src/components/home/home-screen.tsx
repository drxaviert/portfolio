import { HomeLayout } from "@/components/home/home-layout";
import { FEATURED_SLUG, getWork } from "@/lib/work";
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
