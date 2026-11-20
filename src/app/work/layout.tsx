import type { ReactNode } from "react";
import { HomeScreen } from "@/components/home/home-screen";
import { WorkDrawer } from "@/components/work/work-drawer";

/**
 * Runs while the document is parsed, before the index paints: the stored
 * layout is on <html> from the first frame, so a visitor who chose the list
 * never sees the grid. Guarded like every storage read.
 */
const LAYOUT_BOOTSTRAP = `try{if(localStorage.getItem("wd-work-layout")==="list"){document.documentElement.setAttribute("data-work-layout","list")}}catch(e){}`;

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
      <script dangerouslySetInnerHTML={{ __html: LAYOUT_BOOTSTRAP }} />
      <HomeScreen />
      <WorkDrawer>{children}</WorkDrawer>
    </>
  );
}
