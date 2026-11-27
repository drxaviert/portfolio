import type { ReactNode } from "react";
import { WorkDrawer } from "@/components/work/work-drawer";

/**
 * `/work` and `/work/<slug>` are one route segment, so they share this layout:
 * the drawer over the homepage, once for every `/work*` URL.
 *
 * The homepage underneath is the `(site)` layout's HomeScreen, the same mounted
 * instance as on `/`, so a study, the index and the way back all happen above
 * it and closing the drawer reveals the page exactly as it was left, shred,
 * carousel and player included.
 */
export default function WorkLayout({ children }: { children: ReactNode }) {
  return <WorkDrawer>{children}</WorkDrawer>;
}
