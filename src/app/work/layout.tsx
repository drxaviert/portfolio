import type { ReactNode } from "react";
import { ArtCard } from "@/components/home/art-card/art-card";
import { HomeScreen } from "@/components/home/home-screen";
import { WorkDrawer } from "@/components/work/work-drawer";
import { getTodaysArt } from "@/lib/daily-art";

/**
 * `/work` and `/work/<slug>` are one route segment, so they share this layout:
 * the homepage underneath and the drawer over it, once for every `/work*` URL.
 *
 * The homepage stays mounted while the drawer is open — a study, the index and
 * the way back all happen above it — so closing the drawer reveals the page
 * exactly as it was left, with the card or the nav still where the reverse
 * morph needs it.
 *
 * Like `/`, this server entry owns the daily painting fetch and passes the
 * filled card to the sync HomeScreen.
 */
export default async function WorkLayout({
  children,
}: {
  children: ReactNode;
}) {
  const art = await getTodaysArt();

  return (
    <>
      <HomeScreen playCard={<ArtCard art={art} />} />
      <WorkDrawer>{children}</WorkDrawer>
    </>
  );
}
