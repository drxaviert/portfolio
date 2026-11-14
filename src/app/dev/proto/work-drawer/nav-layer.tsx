"use client";

import { motion } from "motion/react";
import { HomeNav } from "@/components/home/home-nav";
import type { CSSProperties } from "react";
import { CloseButton } from "./close-button";
import { CLOSE_S, EASE_ENTER, MORPH_S } from "./motion";
import type { ReaderLayout } from "./nav-layout";
import type { NavMode, Rect } from "./types";

/**
 * The real HomeNav, carried into the expanded reader:
 *
 * - stay:   static copy at the page nav's box, below the reader
 * - float:  the bar shrinks/slides into a bottom-centre pill
 * - header: the bar flies to the top of the reader, with the close beside it
 *
 * It is the shipped component, not a look-alike, so the live ThemeToggle and
 * its phase row keep working. The layer sits above the reader and backdrop.
 */

function fixedBox(rect: Rect): CSSProperties {
  return {
    position: "fixed",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

const REST_RADIUS = 12;
const PILL_RADIUS = 999;

export function ReaderNav({
  mode,
  layout,
  closing,
  reduce,
}: {
  mode: NavMode;
  layout: ReaderLayout;
  closing: boolean;
  reduce: boolean;
}) {
  if (mode === "stay") {
    return (
      <div className="wd-nav wd-nav-stay" style={fixedBox(layout.nav)}>
        <HomeNav />
      </div>
    );
  }

  const radius = mode === "float" ? PILL_RADIUS : REST_RADIUS;
  const closed = {
    left: layout.navFrom.left,
    top: layout.navFrom.top,
    width: layout.navFrom.width,
    height: layout.navFrom.height,
    borderRadius: REST_RADIUS,
  };
  const open = {
    left: layout.nav.left,
    top: layout.nav.top,
    width: layout.nav.width,
    height: layout.nav.height,
    borderRadius: radius,
  };

  return (
    <motion.div
      className={`wd-nav ${mode === "float" ? "wd-nav-float" : "wd-nav-header"}`}
      style={
        reduce ? { ...fixedBox(layout.nav), borderRadius: radius } : undefined
      }
      initial={reduce ? { opacity: 0 } : { ...closed, opacity: 1 }}
      animate={
        reduce
          ? { opacity: closing ? 0 : 1 }
          : closing
            ? { ...closed, opacity: 1 }
            : { ...open, opacity: 1 }
      }
      transition={
        reduce
          ? { duration: 0.12, ease: "easeOut" }
          : {
              duration: closing ? CLOSE_S : MORPH_S,
              ease: closing ? "easeIn" : EASE_ENTER,
            }
      }
    >
      <HomeNav />
    </motion.div>
  );
}

/** Fixed surface behind the header-mode nav; also holds the close button. */
export function NavHeaderBar({
  layout,
  visible,
  onRequestClose,
}: {
  layout: ReaderLayout;
  visible: boolean;
  onRequestClose: () => void;
}) {
  const bar = layout.headerBar;
  const close = layout.headerClose;

  if (!bar || !close) return null;

  return (
    <div
      className="wd-nav-header-bar"
      style={fixedBox(bar)}
      data-visible={visible ? "" : undefined}
      inert={visible ? undefined : true}
    >
      <CloseButton
        className="wd-header-close"
        onRequestClose={onRequestClose}
        style={{
          position: "absolute",
          left: close.left - bar.left,
          top: close.top - bar.top,
          width: close.width,
          height: close.height,
        }}
      />
    </div>
  );
}
