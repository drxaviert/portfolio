"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useState } from "react";
import { markDrawerRestore } from "@/components/work/drawer-restore";
import { hasWebGLSupport, isSafari } from "./environment";
import {
  HUMAN_CONTACT_CLOSE,
  applyHumanContactTileVars,
  markHumanContactReturn,
  readHumanContactBox,
} from "./human-contact-motion";
import "./human-contact.css";

const HumanContactScene = dynamic(
  () =>
    import("./human-contact-scene").then((module) => module.HumanContactScene),
  {
    ssr: false,
    loading: () => null,
  },
);

const NAV_ITEMS = ["ABOUT", "WORK", "HUMANS", "CAREERS", "CONTACT", "FRANÇAIS"];

export type HumanContactMode = "full" | "embed";

/** Safari gets the still; the page never starts a WebGL loop there. */
function subscribe() {
  return () => {};
}

let liveCapability: boolean | null = null;

function getLiveCapability(): boolean {
  if (typeof navigator === "undefined") return false;

  if (liveCapability === null) {
    liveCapability = !isSafari() && hasWebGLSupport();
  }

  return liveCapability;
}

function getServerLiveCapability(): boolean {
  return false;
}

export function HumanContactExperience({
  mode = "full",
}: {
  mode?: HumanContactMode;
}) {
  const capable = useSyncExternalStore(
    subscribe,
    getLiveCapability,
    getServerLiveCapability,
  );
  const [failed, setFailed] = useState(false);
  const live = capable && !failed;
  const router = useRouter();

  // The study is the only way back, and its shared-element close needs the
  // route cached before the click. Next does not prefetch in development, so
  // ask for it here; in production this is already warm from the Link.
  useEffect(() => {
    if (mode === "full") router.prefetch("/work/human-contact");
  }, [mode, router]);

  return (
    <div className="hc-experience" data-mode={mode}>
      {live ? <HumanContactScene onFallback={() => setFailed(true)} /> : null}

      <div className="hc-cover" aria-hidden="true" />
      <div className="hc-film" aria-hidden="true" />

      <div className="hc-overlay">
        <div className="hc-monogram" aria-hidden="true">
          HC.
        </div>

        <nav className="hc-nav" aria-label="Human Contact navigation">
          {NAV_ITEMS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>

        {mode === "full" ? (
          <h1 className="hc-wordmark">HUMANCONTACT</h1>
        ) : (
          <p className="hc-wordmark" aria-hidden="true">
            HUMANCONTACT
          </p>
        )}

        {mode === "full" ? (
          <Link
            className="hc-back"
            href="/work/human-contact"
            transitionTypes={[HUMAN_CONTACT_CLOSE]}
            onClick={() => {
              markDrawerRestore();
              markHumanContactReturn();
              applyHumanContactTileVars(readHumanContactBox());
            }}
          >
            <span aria-hidden="true">←</span> Case study
          </Link>
        ) : null}
      </div>
    </div>
  );
}
