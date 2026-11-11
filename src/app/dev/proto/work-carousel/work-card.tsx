"use client";

import type { Ref } from "react";
import { motion } from "motion/react";
import type { Transition } from "motion/react";
import type { Work } from "./works";

export type Slot = "featured" | "medium" | "peek";

type Props = {
  work: Work;
  slot: Slot;
  index: number;
  position: number;
  width: number;
  /** Left offset of the slot, animated as a transform (the strip slides). */
  x: number;
  artWidth: number;
  transition: Transition;
  onSelect: (index: number, moveFocus: boolean) => void;
  featuredRef: Ref<HTMLAnchorElement>;
};

/**
 * One slot of the strip. The li owns the slot (Motion tweens x and width); the
 * card inside carries the visual layers plus a transparent hit target, so the
 * visual subtree survives a slot change and its title cross-fade can animate.
 *
 * The art layer is pinned to the featured width and clipped by the card, so a
 * squeezed slot shows a crop of the poster. The title, meta and the two title
 * layers stay in normal flow, so text never scales or distorts.
 */
export function WorkCard({
  work,
  slot,
  index,
  position,
  width,
  x,
  artWidth,
  transition,
  onSelect,
  featuredRef,
}: Props) {
  return (
    <motion.li
      className="absolute top-0 left-0 h-full"
      style={{ zIndex: slot === "featured" ? 2 : slot === "medium" ? 1 : 0 }}
      initial={false}
      animate={{ x, width }}
      transition={transition}
    >
      <div className="wc-card" data-slot={slot}>
        <span className="wc-ring-frame" aria-hidden="true">
          <span className="wc-ring-glow" aria-hidden="true" />
        </span>
        <span className="wc-surface" aria-hidden="true" />

        <div className="wc-content" aria-hidden="true">
          <span
            className="wc-art"
            style={{ width: `${artWidth}px` }}
            aria-hidden="true"
          >
            <span className="wc-art-wash" />
            <span className="wc-art-motif" data-art={work.art} />
          </span>

          <div className="wc-body">
            <span className="wc-index">
              {String(position).padStart(2, "0")}
            </span>
            <p className="wc-meta">
              {work.meta} · {work.year}
            </p>
            <div className="wc-titlebox">
              <span className="wc-title wc-title--compact">{work.title}</span>
              <span className="wc-title wc-title--featured">{work.title}</span>
            </div>
          </div>
        </div>

        {slot === "featured" ? (
          <a
            ref={featuredRef}
            className="wc-hit"
            href={`/work/${work.slug}`}
            aria-label={`Open ${work.title}, ${work.meta} ${work.year}`}
          />
        ) : slot === "medium" ? (
          <button
            type="button"
            className="wc-hit"
            aria-label={`Feature ${work.title}`}
            onClick={(event) => onSelect(index, event.detail === 0)}
          />
        ) : null}
      </div>
    </motion.li>
  );
}
