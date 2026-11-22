import type { ReactNode } from "react";
import { HomeScreen } from "@/components/home/home-screen";
import { BackMenuDevSwitch } from "@/components/work/back-menu/dev-switch";
import { WorkDrawer } from "@/components/work/work-drawer";

/**
 * `/work` and `/work/<slug>` are one route segment, so they share this layout:
 * the homepage underneath and the drawer over it, once for every `/work*` URL.
 *
 * The homepage stays mounted while the drawer is open — a study, the index and
 * the way back all happen above it — so closing the drawer reveals the page
 * exactly as it was left, with the card or the nav still where the reverse
 * morph needs it.
 */
export default function WorkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HomeScreen />
      <WorkDrawer>{children}</WorkDrawer>
      <BackMenuDevSwitch />
    </>
  );
}
