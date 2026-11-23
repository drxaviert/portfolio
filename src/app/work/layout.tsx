import type { ReactNode } from "react";
import { HomeScreen } from "@/components/home/home-screen";
import { WorkDrawer } from "@/components/work/work-drawer";

/**
 * The `panel` prototype mode's pre-paint marker. `/work` is a static shell that
 * cannot see the query, so without this a hard load of `?thumb=panel` would
 * paint the shipped list first and jump right when `WorkList` reads the param
 * after hydration. This runs at parse time, before the list below it, and sets
 * the one document marker the panel layout keys on; `WorkList` keeps the marker
 * in step afterwards (reveal, resize, dev toggle) and drops it for every other
 * variant. The gate is repeated here because the CSS cannot ask.
 */
const WORK_THUMB_INIT_SCRIPT = `(function(){try{if(!window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)").matches)return;if(new URLSearchParams(location.search).get("thumb")==="panel")document.documentElement.setAttribute("data-work-thumb","panel");}catch(error){}})();`;

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
      <script dangerouslySetInnerHTML={{ __html: WORK_THUMB_INIT_SCRIPT }} />
      <HomeScreen />
      <WorkDrawer>{children}</WorkDrawer>
    </>
  );
}
