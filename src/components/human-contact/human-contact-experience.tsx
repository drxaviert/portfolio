"use client";

import dynamic from "next/dynamic";
import { HOVER_VARIANTS, selectHoverVariant, useHoverVariant } from "./variant";

const HumanContactScene = dynamic(
  () =>
    import("./human-contact-scene").then((module) => module.HumanContactScene),
  {
    ssr: false,
    loading: () => <div className="hc-canvas" aria-hidden="true" />,
  },
);

const NAV_ITEMS = ["ABOUT", "WORK", "HUMANS", "CAREERS", "CONTACT", "FRANÇAIS"];

export function HumanContactExperience() {
  const variant = useHoverVariant();

  return (
    <main className="hc-page">
      <HumanContactScene variant={variant} />
      <div className="hc-cover" aria-hidden="true" />

      <div className="hc-overlay">
        <div className="hc-monogram" aria-hidden="true">
          HC.
        </div>

        <nav className="hc-nav" aria-label="Human Contact navigation">
          {NAV_ITEMS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>

        <h1 className="hc-wordmark">HUMANCONTACT</h1>

        <p className="hc-credit">
          Recreation of HUMANCONTACT INC.&apos;s homepage (humancontact.com).
          Hover interaction added by Dat.
        </p>
      </div>

      <div className="hc-variants" role="group" aria-label="Hover variant">
        {HOVER_VARIANTS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={variant === option.id}
            onClick={() => selectHoverVariant(option.id)}
          >
            {option.id.toUpperCase()} · {option.label}
          </button>
        ))}
      </div>
    </main>
  );
}
