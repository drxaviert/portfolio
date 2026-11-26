import { ArtCard } from "@/components/home/art-card/art-card";
import { HomeScreen } from "@/components/home/home-screen";
import { ViewportEdgeBlur } from "@/components/edge-blur/viewport-edge-blur";
import { getTodaysArt } from "@/lib/daily-art";

/**
 * `/`: the homepage as the page. A study's direct load renders it too.
 *
 * The route entry owns the async data: it awaits today's painting and hands the
 * filled card to the sync HomeScreen, so the client-reachable HomeLayout never
 * fetches or calls a Server Action during initial render.
 *
 * The viewport edge blur is mounted here rather than in the root layout, so it
 * exists on `/` alone: `/work*` composes HomeScreen from its own layout and
 * therefore gets no bands. Opening a study from here still covers both bands
 * with the drawer panel, which is what the bands' own comment promises.
 */
export default async function Home() {
  const art = await getTodaysArt();

  return (
    <>
      <HomeScreen playCard={<ArtCard art={art} />} />
      <ViewportEdgeBlur />
    </>
  );
}
