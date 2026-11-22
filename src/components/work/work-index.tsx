"use client";

import type { WorkMeta } from "@/lib/work";
import { Breadcrumb } from "./breadcrumb";
import { WorkList } from "./work-list";
import "./work-index.css";

export { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

/**
 * The /work index: one list of case studies inside the drawer panel, under the
 * nav. The list owns its own scroll container and the hover thumbnail; this
 * wrapper exists so the drawer keeps its stable `INDEX_TITLE_ID` import, and it
 * puts the shared Breadcrumb ("Home / Work") at the top of the list.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  return <WorkList works={works} topControl={<Breadcrumb />} />;
}
