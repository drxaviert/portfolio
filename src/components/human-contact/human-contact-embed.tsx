"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { useDrawerRestoreToken } from "@/components/work/drawer-restore-context";
import {
  HUMAN_CONTACT_OPEN,
  applyHumanContactTileVars,
  consumeHumanContactReturn,
  humanContactScrollParent,
  readHumanContactBox,
  rememberHumanContactBox,
  type HumanContactBox,
} from "./human-contact-motion";
import { HumanContactStill } from "./human-contact-still";

const HumanContactExperience = dynamic(
  () =>
    import("./human-contact-experience").then(
      (module) => module.HumanContactExperience,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * The case-study embed. The still is server-rendered underneath the live
 * scene, so a reader without WebGL, a Safari reader, or a reader whose context
 * is lost still sees the grid. The scene chunk itself is loaded only when this
 * component mounts on a study that uses it.
 */
export function HumanContactEmbed({ wide = false }: { wide?: boolean }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const restoreToken = useDrawerRestoreToken();

  // A back navigation shows the drawer at the top. Wait for its restore token
  // (the drawer is at its closed pose until the parent's layout effect runs),
  // then put the study back on the stored rect before the close snapshot is
  // captured, so the tile lands on the embed.
  useLayoutEffect(() => {
    if (restoreToken === 0) return;
    if (!consumeHumanContactReturn()) return;

    const box = readHumanContactBox();
    const element = boxRef.current;
    if (!box || !element) return;

    const scroller = humanContactScrollParent(element);
    if (!scroller) return;

    scroller.scrollTop += element.getBoundingClientRect().top - box.top;
  }, [restoreToken]);

  // The live route's tile starts and lands on this rect. Capture it on the
  // click, after any scroll, and keep it for the return trip.
  function rememberTile(): void {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;

    const box: HumanContactBox = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    rememberHumanContactBox(box);
    applyHumanContactTileVars(box);
  }

  return (
    <figure
      className={["hc-embed-figure", wide && "hc-embed-figure-wide"]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="hc-embed-box" ref={boxRef}>
        <HumanContactStill />
        <HumanContactExperience mode="embed" />
      </div>

      <figcaption className="hc-embed-caption">
        Live recreation. The original had no hover; the scale is Dat&apos;s
        addition.{" "}
        <Link
          className="hc-embed-open"
          href="/live/human-contact"
          transitionTypes={[HUMAN_CONTACT_OPEN]}
          onClick={rememberTile}
        >
          Open full screen
        </Link>
      </figcaption>
    </figure>
  );
}
