"use client";

import Link from "next/link";
import type { MouseEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import { GlideCapsule } from "@/components/home/glide-capsule";
import { NAV_ITEM_CLASS } from "@/components/home/nav-item-class";
import { isPhaseSwitching } from "@/lib/theme";
import { useDrawerActions } from "./drawer-actions";
import "@/components/home/nav-items.css";
import "./breadcrumb.css";

export type BreadcrumbProps = {
  /** The study's title. Omit on the /work index. */
  title?: string;
};

/**
 * The drawer's one way back, shared by the index and every study.
 *
 * The segments are the home nav's items down to the class names: the same
 * 32px box, 8px padding, 8px radius, 16px/500 label and `on-surface-variant` →
 * `on-surface` colour. The same GlideCapsule runs underneath, so hovering
 * between Home and Work uses the nav's spring pair and the same 0.55 fill;
 * reduced motion drops the travel and crossfades the nav's item fill instead.
 *
 * The actions are the drawer's own, never a route push: on the index Home runs
 * Esc's `exit` (generation + burst guards); in a study Home closes the whole
 * drawer and Work runs `stepBack` (the browser-Back path that keeps the panel
 * and restores the index's scroll). A modified click follows the href.
 */
export function Breadcrumb({ title }: BreadcrumbProps) {
  const actions = useDrawerActions();
  const reader = title !== undefined;
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const homeAction = actions
    ? reader
      ? () => void actions.close()
      : actions.exit
    : undefined;
  const workAction = reader ? actions?.stepBack : undefined;

  function onLinkClick(
    event: MouseEvent<HTMLAnchorElement>,
    action?: () => void,
  ) {
    if (!action) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    action();
  }

  function enter(index: number, event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;

    setHoverIndex(index);
  }

  function leaveRun() {
    // A theme crossfade snapshots the page and the live document stops
    // receiving hit tests for its length, so this is not a real leave.
    if (isPhaseSwitching()) return;

    setHoverIndex(null);
  }

  return (
    <div className="wd-breadcrumb">
      <nav
        aria-label="Breadcrumb"
        className="breadcrumb-nav"
        onPointerLeave={leaveRun}
      >
        <GlideCapsule
          items={itemRefs}
          target={hoverIndex ?? 0}
          visible={hoverIndex !== null}
        />

        <ol className="breadcrumb-list">
          <li className="breadcrumb-item">
            <Link
              href="/"
              ref={(node) => {
                itemRefs.current[0] = node;
              }}
              className={`no-underline ${NAV_ITEM_CLASS} text-on-surface-variant`}
              onPointerEnter={(event) => enter(0, event)}
              onClick={(event) => onLinkClick(event, homeAction)}
            >
              Home
            </Link>
          </li>

          <li className="breadcrumb-sep" aria-hidden="true">
            /
          </li>

          <li className="breadcrumb-item">
            {reader ? (
              <Link
                href="/work"
                ref={(node) => {
                  itemRefs.current[1] = node;
                }}
                className={`no-underline ${NAV_ITEM_CLASS} text-on-surface-variant`}
                onPointerEnter={(event) => enter(1, event)}
                onClick={(event) => onLinkClick(event, workAction)}
              >
                Work
              </Link>
            ) : (
              <span
                className={`${NAV_ITEM_CLASS} text-on-surface`}
                aria-current="page"
              >
                Work
              </span>
            )}
          </li>

          {reader ? (
            <>
              <li className="breadcrumb-sep" aria-hidden="true">
                /
              </li>
              <li className="breadcrumb-item">
                <span
                  className={`${NAV_ITEM_CLASS} breadcrumb-current text-on-surface`}
                  aria-current="page"
                  title={title}
                >
                  {title}
                </span>
              </li>
            </>
          ) : null}
        </ol>
      </nav>
    </div>
  );
}
