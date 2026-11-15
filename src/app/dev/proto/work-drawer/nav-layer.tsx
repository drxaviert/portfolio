"use client";

import { motion } from "motion/react";
import { HomeNav } from "@/components/home/home-nav";
import type { CSSProperties } from "react";
import { CloseButton } from "./close-button";
import { CLOSE_S, EASE_ENTER, MORPH_S } from "./motion";
import type { ReaderLayout } from "./nav-layout";
import type { NavMode, Rect } from "./types";

/**
 * The real HomeNav, carried into the expanded reader. The wrapper only moves
 * it: left, width and height are always the homepage nav's measured box, so
 * the component inside is pixel-identical to / in every placement.
 *
 * - stay:   at the page nav's slot below the reader (docked when off-screen)
 * - float:  the same bar docked over the bottom of the reader
 * - header: the same bar at the top; the close lives in its own row above it
 *
 * The live ThemeToggle and its phase row keep working in all three.
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
      <div className="wd-nav" style={fixedBox(layout.nav)}>
        <HomeNav />
      </div>
    );
  }

  if (reduce) {
    return (
      <motion.div
        className="wd-nav"
        style={fixedBox(layout.nav)}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
      >
        <HomeNav />
      </motion.div>
    );
  }

  // Only the vertical position changes; the bar's box stays the homepage's.
  return (
    <motion.div
      className="wd-nav"
      style={fixedBox({ ...layout.nav, top: layout.navFrom.top })}
      initial={{ top: layout.navFrom.top }}
      animate={{ top: closing ? layout.navFrom.top : layout.nav.top }}
      transition={{
        duration: closing ? CLOSE_S : MORPH_S,
        ease: closing ? "easeIn" : EASE_ENTER,
      }}
    >
      <HomeNav />
    </motion.div>
  );
}

/** Fixed surface behind the header nav; also holds the close button. */
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
