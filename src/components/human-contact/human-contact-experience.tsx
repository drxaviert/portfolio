"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { hasWebGLSupport, isSafari } from "./environment";
import type { LightingPreset } from "./lighting";
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
  lighting = "current",
}: {
  mode?: HumanContactMode;
  lighting?: LightingPreset;
}) {
  const capable = useSyncExternalStore(
    subscribe,
    getLiveCapability,
    getServerLiveCapability,
  );
  const [failed, setFailed] = useState(false);
  const live = capable && !failed;

  return (
    <div className="hc-experience" data-mode={mode} data-light={lighting}>
      {live ? (
        <HumanContactScene
          lighting={lighting}
          onFallback={() => setFailed(true)}
        />
      ) : null}

      <div className="hc-cover" aria-hidden="true" />

      {lighting === "film" ? (
        <div className="hc-film" aria-hidden="true" />
      ) : null}

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

        <p className="hc-credit">
          Original design: HUMANCONTACT INC. (humancontact.com).{" "}
          <span className="hc-credit-hover">
            Hover interaction: Dat&apos;s addition.
          </span>
        </p>

        {mode === "full" ? (
          <Link className="hc-back" href="/work/human-contact">
            <span aria-hidden="true">←</span> Case study
          </Link>
        ) : null}
      </div>
    </div>
  );
}
