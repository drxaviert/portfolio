"use client";

import type { WorkMeta } from "@/lib/work";
import {
  BackClose,
  BelowClose,
  PillClose,
  useCloseVariant,
} from "./close-control";
import { WorkList } from "./work-list";
import "./work-index.css";

export { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

/**
 * The /work index: one list of case studies inside the drawer panel, under the
 * nav. The list owns its own scroll container and the hover thumbnail; this
 * wrapper exists so the drawer keeps its stable `INDEX_TITLE_ID` import, and it
 * places the index's close control according to the live variant
 * (close-variant.ts): under the nav (`below`, the shipped placement), in the
 * list column (`back`), or as the bottom-centre pill (`pill`). The nav and
 * corner placements live where they must live — in the bar and outside the
 * panel — so the drawer shell and the nav own those.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  const variant = useCloseVariant();

  return (
    <>
      {variant === "below" ? <BelowClose /> : null}
      {variant === "pill" ? <PillClose /> : null}
      <WorkList
        works={works}
        topControl={variant === "back" ? <BackClose /> : null}
      />
    </>
  );
}
