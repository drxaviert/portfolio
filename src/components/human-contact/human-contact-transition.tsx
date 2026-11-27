"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { markDrawerRestore } from "@/components/work/drawer-restore";
import { useEffect, useState } from "react";
import {
  HUMAN_CONTACT_CLOSE,
  HUMAN_CONTACT_OPEN,
  HUMAN_CONTACT_VIEW_TRANSITION,
  applyHumanContactTileVars,
  markHumanContactDirection,
  markHumanContactReturn,
  readHumanContactBox,
} from "./human-contact-motion";

function hasTileRect(): boolean {
  if (typeof window === "undefined") return false;

  return readHumanContactBox() !== null;
}

/**
 * The live route is the only named participant. It enters from the case-study
 * embed's stored rect and exits back to it, so the motion does not depend on
 * the destination page pairing with the source — the work page's content
 * commits separately in development, where Next does not prefetch.
 *
 * The embed link stores the rect and writes the geometry variables before the
 * navigation; the back link does the same from the stored rect. Reduced motion
 * renders the page with no view transition at all, so it lands directly.
 */
export function HumanContactTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  // Read once: a client navigation mounts this after the embed stored the
  // rect, and a direct load with an old rect still has a valid tile to use.
  const [hasRect] = useState(hasTileRect);

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== "/work/human-contact") return;

      markDrawerRestore();
      markHumanContactReturn();
      applyHumanContactTileVars(readHumanContactBox());
    };

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (reduced || !hasRect) return <>{children}</>;

  return (
    <ViewTransition
      name={HUMAN_CONTACT_VIEW_TRANSITION}
      enter={{ [HUMAN_CONTACT_OPEN]: HUMAN_CONTACT_OPEN, default: "none" }}
      exit={{
        [HUMAN_CONTACT_CLOSE]: HUMAN_CONTACT_CLOSE,
        default: HUMAN_CONTACT_CLOSE,
      }}
      default="none"
      onEnter={(_instance, types) => {
        if (!types.includes(HUMAN_CONTACT_OPEN)) return;
        if (!applyHumanContactTileVars(readHumanContactBox())) return;

        return markHumanContactDirection(HUMAN_CONTACT_OPEN);
      }}
      onExit={() => {
        if (window.location.pathname !== "/work/human-contact") return;
        if (!applyHumanContactTileVars(readHumanContactBox())) return;

        return markHumanContactDirection(HUMAN_CONTACT_CLOSE);
      }}
    >
      {children}
    </ViewTransition>
  );
}
