"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ROUTE_MOTION_TYPE } from "@/components/route-transition/route-motion";
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
  return (
    <figure
      className={["hc-embed-figure", wide && "hc-embed-figure-wide"]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="hc-embed-box">
        <HumanContactStill />
        <HumanContactExperience mode="embed" />
      </div>

      <figcaption className="hc-embed-caption">
        Live recreation. The original had no hover; the scale is Dat&apos;s
        addition.{" "}
        <Link
          className="hc-embed-open"
          href="/live/human-contact"
          transitionTypes={[ROUTE_MOTION_TYPE]}
        >
          Open full screen
        </Link>
      </figcaption>
    </figure>
  );
}
