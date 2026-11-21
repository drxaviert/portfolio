"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkIndex } from "@/components/work/work-index";
import type { WorkMeta } from "@/lib/work";
import { PANEL_CSS } from "./panel-css";
import { VARIANT_IDS, VARIANTS, protoQuery } from "./settings";
import type { VariantId } from "./settings";
import { ExpressiveIndex } from "./variants/expressive";
import { RefinedIndex } from "./variants/refined";
import { RestructuredIndex } from "./variants/restructured";
import "./frame.css";

/**
 * The prototype's stage: the drawer's index column (max 1184px, 16px side
 * padding, 32px from 768px) on the drawer's surface, with the selected variant
 * inside it and a floating switcher.
 *
 * A frame, not the real WorkDrawer: the drawer shell owns the route, the nav
 * and the morph, none of which a layout comparison needs. `current` still
 * renders the production <WorkIndex> unchanged, inside a full-height box that
 * gives its own scroll container a height.
 */
export function WorkIndexProto({
  works,
  initialVariant,
  initialDoubled,
}: {
  works: WorkMeta[];
  initialVariant: VariantId;
  initialDoubled: boolean;
}) {
  const router = useRouter();
  const [variant, setVariant] = useState<VariantId>(initialVariant);
  const [doubled, setDoubled] = useState(initialDoubled);

  const items = useMemo(
    () => (doubled ? [...works, ...works] : works),
    [works, doubled],
  );

  const update = useCallback(
    (v: VariantId, x2: boolean) => {
      setVariant(v);
      setDoubled(x2);
      router.replace(protoQuery(window.location.search, v, x2), {
        scroll: false,
      });
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      const next = VARIANT_IDS[Number(event.key) - 1];
      if (next) update(next, doubled);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update, doubled]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

      <div className="wip-stage" data-variant={variant}>
        {variant === "current" ? (
          <div className="wip-current">
            <WorkIndex works={items} />
          </div>
        ) : (
          <div className="wip-frame">
            {variant === "a" ? <RefinedIndex works={items} /> : null}
            {variant === "b" ? <RestructuredIndex works={items} /> : null}
            {variant === "c" ? <ExpressiveIndex works={items} /> : null}
          </div>
        )}
      </div>

      <aside className="wip-panel" aria-label="Prototype controls">
        <div>
          <p className="wip-panel-title">Work index</p>
          <p className="wip-panel-note">keys 1-4 · throwaway</p>
        </div>

        <div className="wip-panel-variants">
          {VARIANTS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="wip-panel-variant"
              data-active={variant === item.id ? "" : undefined}
              aria-pressed={variant === item.id}
              onClick={() => update(item.id, doubled)}
            >
              <span>{item.label}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>

        <label className="wip-panel-check">
          <input
            type="checkbox"
            checked={doubled}
            onChange={(event) => update(variant, event.target.checked)}
          />
          <span>×2 items ({items.length} shown)</span>
        </label>
      </aside>
    </>
  );
}
